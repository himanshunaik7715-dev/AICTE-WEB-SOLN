import express from 'express';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { enqueueEmail, getJobStatus, getEmailServiceHealth } from './src/services/resendServerService';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '20mb' }));

  // Gemini API Certificate Auto-Categorization (Naming-Convention Fallback)
  app.post('/api/gemini/classify-certificate', async (req, res) => {
    try {
      const { fileData, mimeType, fileName, fileText, certificateId } = req.body;

      if (!fileData && !fileName && !fileText) {
        return res.status(400).json({
          error: 'At least one of "fileData", "fileName", or "fileText" is required for classification.',
        });
      }

      const { classifyCertificatePdf } = await import('./src/services/certificateAiService');
      const classification = await classifyCertificatePdf({
        fileData,
        mimeType,
        fileName,
        fileText,
      });

      // If certificateId is provided and Supabase is configured, store classification log & update status
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (certificateId && supabaseUrl && serviceRoleKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
          const categoryCode = classification.category !== 'unrecognized' ? classification.category : null;

          await supabaseAdmin.rpc('apply_ai_classification', {
            p_certificate_id: certificateId,
            p_raw_response: classification,
            p_category_code: categoryCode,
            p_title: classification.title,
            p_reason: classification.reason,
          });
        } catch (dbErr) {
          console.warn('Notice calling apply_ai_classification RPC:', dbErr);
        }
      }

      return res.json({
        success: true,
        data: classification,
      });
    } catch (err: any) {
      console.error('Error in /api/gemini/classify-certificate:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to classify certificate with Gemini AI.',
      });
    }
  });

  // Google Drive Public Folder File Sync & Naming Convention Extractor (Real Google Drive API v3)
  app.post('/api/drive/fetch-folder-files', async (req, res) => {
    try {
      const { folderUrlOrId, semester } = req.body;
      if (!folderUrlOrId) {
        return res.status(400).json({ error: 'folderUrlOrId is required' });
      }

      let folderId = folderUrlOrId.trim();
      const matchFolder = folderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (matchFolder) folderId = matchFolder[1];

      const apiKey =
        process.env.GOOGLE_DRIVE_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error:
            'Google Drive API key is missing on the server. Please set GOOGLE_DRIVE_API_KEY in server environment / secrets.',
        });
      }

      // Recursive folder tree fetcher using Google Drive API v3
      async function fetchDriveTree(
        fId: string,
        currentPath: string = '',
        depth: number = 0
      ): Promise<any[]> {
        if (depth > 5) return [];

        const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${fId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime,size)&pageSize=1000&key=${apiKey}`;
        const fetchRes = await fetch(apiUrl);

        if (!fetchRes.ok) {
          const errBody = await fetchRes.text();
          throw new Error(
            `Google Drive API error (${fetchRes.status}). Ensure the folder is public ("Anyone with the link can view"). Details: ${errBody}`
          );
        }

        const json = await fetchRes.json();
        const items = json.files || [];
        let collected: any[] = [];

        for (const item of items) {
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            const subPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            const children = await fetchDriveTree(item.id, subPath, depth + 1);
            collected.push(...children);
          } else {
            collected.push({
              ...item,
              subfolderPath: currentPath || 'Root',
            });
          }
        }
        return collected;
      }

      const rawDriveItems = await fetchDriveTree(folderId);

      // Map each file to structured certificate item with status
      const processedFiles = rawDriveItems.map((file) => {
        const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        // Semester detection from subfolder name
        const detectedSem = mapSubfolderToSemester(file.subfolderPath, semester || 'SEM_1');

        if (!isPdf) {
          return {
            id: file.id,
            driveFileId: file.id,
            name: file.name,
            subfolderPath: file.subfolderPath,
            categoryCode: null,
            categoryNo: 1,
            title: file.name,
            webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            mimeType: file.mimeType || 'application/octet-stream',
            semester: detectedSem,
            status: 'skipped_not_pdf',
            hasNamingConvention: false,
            modifiedTime: file.modifiedTime || file.createdTime,
          };
        }

        // Enhanced Filename parsing supporting:
        // 1) New Convention: SEM-01_CAT-06_SmartIndiaHackathonWinner.pdf
        // 2) Legacy Convention: CAT-06_SmartIndiaHackathonWinner.pdf
        const cleanName = file.name || '';
        const nameNoExt = cleanName.replace(/\.pdf$/i, '').trim();

        let categoryCode: string | null = null;
        let categoryNo = 1;
        let title = nameNoExt;
        let hasConvention = false;
        let status = 'imported';
        let finalSemester = mapSubfolderToSemester(file.subfolderPath, semester || 'SEM_1');

        // Regex 1: SEM-XX_CAT-YY_ActivityTitle.pdf (or SEM01_CAT06_Title.pdf)
        const fullMatch = nameNoExt.match(/^(SEM[_\s-]*0?([1-8]))[_\s-]+(CAT[_\s-]*0?([1-9]|1[0-5]))[_\s-]+(.+)$/i);

        if (fullMatch) {
          const semNum = fullMatch[2]; // e.g., "1"
          const catNum = parseInt(fullMatch[4], 10);
          finalSemester = `SEM_${semNum}`;
          categoryCode = `CAT-${catNum.toString().padStart(2, '0')}`;
          categoryNo = catNum;

          let rawTitle = fullMatch[5].replace(/_[0-9]{6,8}$/, '');
          if (!rawTitle.includes(' ') && !rawTitle.includes('_') && !rawTitle.includes('-')) {
            rawTitle = rawTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
          } else {
            rawTitle = rawTitle.replace(/[_-]/g, ' ');
          }
          title = rawTitle.trim();
          hasConvention = true;
          status = 'imported';
        } else {
          // Regex 2: CAT-YY_ActivityTitle.pdf (without SEM prefix)
          const catMatch = nameNoExt.match(/^(CAT[_\s-]*0?([1-9]|1[0-5]))[_\s-]+(.+)$/i);
          if (catMatch) {
            const catNum = parseInt(catMatch[2], 10);
            categoryCode = `CAT-${catNum.toString().padStart(2, '0')}`;
            categoryNo = catNum;

            let rawTitle = catMatch[3].replace(/_[0-9]{6,8}$/, '');
            if (!rawTitle.includes(' ') && !rawTitle.includes('_') && !rawTitle.includes('-')) {
              rawTitle = rawTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
            } else {
              rawTitle = rawTitle.replace(/[_-]/g, ' ');
            }
            title = rawTitle.trim();
            hasConvention = true;
            status = 'imported';
          } else {
            // Naming error fallback
            if (!title.includes(' ') && !title.includes('_') && !title.includes('-')) {
              title = title.replace(/([a-z])([A-Z])/g, '$1 $2');
            } else {
              title = title.replace(/[_-]/g, ' ');
            }
            title = title.trim();
            status = 'naming_error';
          }
        }

        return {
          id: file.id,
          driveFileId: file.id,
          name: file.name,
          subfolderPath: file.subfolderPath,
          categoryCode,
          categoryNo,
          title: title || 'Activity Certificate',
          webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          mimeType: 'application/pdf',
          semester: finalSemester,
          status,
          hasNamingConvention: hasConvention,
          modifiedTime: file.modifiedTime || file.createdTime,
        };
      });

      return res.json({
        success: true,
        folderId,
        semester: semester || 'SEM_1',
        count: processedFiles.length,
        files: processedFiles,
      });
    } catch (err: any) {
      console.error('Error fetching Google Drive folder files:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to fetch Google Drive folder files.',
      });
    }
  });

  function mapSubfolderToSemester(subfolderPath: string, defaultSemester: string = 'SEM_1'): string {
    if (!subfolderPath) return defaultSemester;
    const upper = subfolderPath.toUpperCase();
    if (upper.includes('SEM 1') || upper.includes('SEM-1') || upper.includes('SEM_1') || upper.includes('SEMESTER 1') || upper.includes('SEMESTER-1') || upper.includes('SEMESTER_1') || upper.includes('SEM01') || upper.includes('SEM 01') || upper.includes('1ST SEM') || upper.includes('SEM I')) return 'SEM_1';
    if (upper.includes('SEM 2') || upper.includes('SEM-2') || upper.includes('SEM_2') || upper.includes('SEMESTER 2') || upper.includes('SEMESTER-2') || upper.includes('SEMESTER_2') || upper.includes('SEM02') || upper.includes('SEM 02') || upper.includes('2ND SEM') || upper.includes('SEM II')) return 'SEM_2';
    if (upper.includes('SEM 3') || upper.includes('SEM-3') || upper.includes('SEM_3') || upper.includes('SEMESTER 3') || upper.includes('SEMESTER-3') || upper.includes('SEMESTER_3') || upper.includes('SEM03') || upper.includes('SEM 03') || upper.includes('3RD SEM') || upper.includes('SEM III')) return 'SEM_3';
    if (upper.includes('SEM 4') || upper.includes('SEM-4') || upper.includes('SEM_4') || upper.includes('SEMESTER 4') || upper.includes('SEMESTER-4') || upper.includes('SEMESTER_4') || upper.includes('SEM04') || upper.includes('SEM 04') || upper.includes('4TH SEM') || upper.includes('SEM IV')) return 'SEM_4';
    if (upper.includes('SEM 5') || upper.includes('SEM-5') || upper.includes('SEM_5') || upper.includes('SEMESTER 5') || upper.includes('SEMESTER-5') || upper.includes('SEMESTER_5') || upper.includes('SEM05') || upper.includes('SEM 05') || upper.includes('5TH SEM') || upper.includes('SEM V')) return 'SEM_5';
    if (upper.includes('SEM 6') || upper.includes('SEM-6') || upper.includes('SEM_6') || upper.includes('SEMESTER 6') || upper.includes('SEMESTER-6') || upper.includes('SEMESTER_6') || upper.includes('SEM06') || upper.includes('SEM 06') || upper.includes('6TH SEM') || upper.includes('SEM VI')) return 'SEM_6';
    if (upper.includes('SEM 7') || upper.includes('SEM-7') || upper.includes('SEM_7') || upper.includes('SEMESTER 7') || upper.includes('SEMESTER-7') || upper.includes('SEMESTER_7') || upper.includes('SEM07') || upper.includes('SEM 07') || upper.includes('7TH SEM') || upper.includes('SEM VII')) return 'SEM_7';
    if (upper.includes('SEM 8') || upper.includes('SEM-8') || upper.includes('SEM_8') || upper.includes('SEMESTER 8') || upper.includes('SEMESTER-8') || upper.includes('SEMESTER_8') || upper.includes('SEM08') || upper.includes('SEM 08') || upper.includes('8TH SEM') || upper.includes('SEM VIII')) return 'SEM_8';
    return defaultSemester;
  }

  // Email API Endpoints (Resend Integration with Queue, Backoff & Deduplication)
  // Verification Code Store (Email -> { code, name, expiresAt, verified })
  const verificationStore = new Map<string, { code: string; name: string; expiresAt: number; verified: boolean }>();

  // Endpoint to send 6-digit email verification code via Resend
  app.post('/api/auth/send-verification', async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

      verificationStore.set(cleanEmail, {
        code,
        name: name || cleanEmail.split('@')[0],
        expiresAt,
        verified: false,
      });

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <div style="background-color: #312e81; padding: 18px 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Thakur College of Engineering & Technology</h2>
            <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 12px;">Resend Email Verification Service</p>
          </div>

          <div style="padding: 24px 0; text-align: center;">
            <h3 style="color: #1e293b; margin-top: 0; font-size: 18px;">Verify Your Email Address</h3>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Hello <strong>${name || 'TCET Student'}</strong>,<br/>
              Use the following 6-digit verification code to complete your account registration on the TCET AICTE Activity Portal.
            </p>

            <div style="background-color: #f1f5f9; border: 2px dashed #6366f1; padding: 16px 28px; border-radius: 12px; display: inline-block; margin: 12px 0 20px 0;">
              <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #312e81;">
                ${code}
              </span>
            </div>

            <p style="color: #64748b; font-size: 12px; margin-top: 10px;">
              ⏱️ This code is valid for <strong>10 minutes</strong>. Powered by Resend Email Service.
            </p>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
            Thakur College of Engineering & Technology (Autonomous) • Resend Verification Service
          </div>
        </div>
      `;

      const result = enqueueEmail({
        to: cleanEmail,
        subject: `[TCET Verification] ${code} is your email verification code`,
        html: emailHtml,
        templateType: 'verification_code',
        idempotencyKey: `verif_code_${cleanEmail}_${Date.now()}`,
      });

      console.log(`[Resend Email Verification Service] Generated code for ${cleanEmail}`);

      return res.json({
        success: true,
        message: 'Verification code dispatched via Resend email service',
        email: cleanEmail,
        jobId: result.jobId,
      });
    } catch (err: any) {
      console.error('Error sending verification code:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to send verification code' });
    }
  });

  // Endpoint to verify 6-digit code
  app.post('/api/auth/verify-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and verification code are required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const inputCode = String(code).trim();
      const stored = verificationStore.get(cleanEmail);

      if (!stored) {
        return res.status(400).json({
          success: false,
          error: 'No active verification code found for this email. Please click "Resend Code".',
        });
      }

      if (Date.now() > stored.expiresAt) {
        return res.status(400).json({
          success: false,
          error: 'Verification code has expired. Please request a new code.',
        });
      }

      if (stored.code !== inputCode) {
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code. Please check your email inbox and try again.',
        });
      }

      stored.verified = true;

      return res.json({
        success: true,
        message: 'Email verified successfully via Resend Email Verification Service!',
        email: cleanEmail,
      });
    } catch (err: any) {
      console.error('Error in /api/auth/verify-code:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to verify code' });
    }
  });

  // Endpoint to check verification status
  app.post('/api/auth/check-verification-status', (req, res) => {
    const { email } = req.body;
    if (!email) return res.json({ verified: false });
    const cleanEmail = String(email).trim().toLowerCase();
    const stored = verificationStore.get(cleanEmail);
    return res.json({ verified: Boolean(stored?.verified) });
  });

  app.post('/api/email/send', (req, res) => {
    try {
      const { to, subject, html, text, from, idempotencyKey, templateType, metadata } = req.body;
      if (!to || !subject || !html) {
        return res.status(400).json({ error: 'Fields "to", "subject", and "html" are required.' });
      }

      const result = enqueueEmail({
        to,
        subject,
        html,
        text,
        from,
        idempotencyKey,
        templateType,
        metadata,
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('Error in /api/email/send:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Server error queueing email' });
    }
  });

  app.post('/api/email/send-batch', (req, res) => {
    try {
      const { emails } = req.body;
      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'Array "emails" is required.' });
      }

      const results = emails.map((opts) =>
        enqueueEmail({
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
          from: opts.from,
          idempotencyKey: opts.idempotencyKey,
          templateType: opts.templateType,
          metadata: opts.metadata,
        })
      );

      return res.json({ success: true, count: results.length, jobs: results });
    } catch (err: any) {
      console.error('Error in /api/email/send-batch:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Server error queueing batch emails' });
    }
  });

  app.get('/api/email/status/:jobId', (req, res) => {
    const job = getJobStatus(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.json({
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      createdAt: job.createdAt,
      messageId: job.messageId,
      error: job.error,
    });
  });

  app.get('/api/email/health', (_req, res) => {
    return res.json(getEmailServiceHealth());
  });

  // API endpoint to check if email exists in Supabase Auth (auth.users)
  app.post('/api/check-user-exists', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ exists: false, error: 'Email is required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://qjalhxxjrufnfokmntjw.supabase.co';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !serviceRoleKey) {
        return res.json({ exists: false, message: 'Supabase credentials not configured' });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      let exists = false;

      // 1. Try checking using Supabase Admin listUsers API (requires service_role key)
      try {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (!error && data?.users && Array.isArray(data.users)) {
          exists = data.users.some((u: any) => u.email?.toLowerCase() === cleanEmail);
        }
      } catch (adminErr) {
        console.warn('Supabase auth admin listUsers check notice:', adminErr);
      }

      // 2. Fallback check in users table if listUsers restricted or didn't find match
      if (!exists) {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (!error && data) {
          exists = true;
        }
      }

      return res.json({ exists });
    } catch (err: any) {
      console.error('Error checking user existence:', err);
      return res.status(500).json({ exists: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: 'localhost', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
