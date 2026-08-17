import express from 'express';
import path from 'path';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import {
  enqueueEmail,
  getJobStatus,
  getEmailServiceHealth,
} from './src/services/resendServerService';

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const isProduction =
  process.env.NODE_ENV === 'production';

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'https://tcetaicte.vercel.app';


// =========================================================
// CORS
// =========================================================

const allowedOrigins = [
  FRONTEND_URL,
  'https://tcetaicte.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin
      // such as Render health checks / curl
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(
        `[CORS] Blocked origin: ${origin}`
      );

      return callback(
        new Error('Not allowed by CORS')
      );
    },
    credentials: true,
  })
);


// =========================================================
// BODY PARSER
// =========================================================

app.use(
  express.json({
    limit: '20mb',
  })
);


// =========================================================
// HEALTH CHECK
// =========================================================

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'TCET AICTE backend is running',
    environment:
      process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});


// =========================================================
// GOOGLE DRIVE
// =========================================================

app.post(
  '/api/drive/fetch-folder-files',
  async (req, res) => {
    try {
      const {
        folderUrlOrId,
        semester,
      } = req.body;

      console.log(
        '[Google Drive] Request received:',
        folderUrlOrId,
        semester
      );

      if (!folderUrlOrId) {
        return res.status(400).json({
          success: false,
          error:
            'folderUrlOrId is required',
        });
      }

      // -------------------------------------------------------
      // Extract folder ID
      // -------------------------------------------------------

      let folderId =
        String(folderUrlOrId).trim();

      const matchFolder =
        folderId.match(
          /\/folders\/([a-zA-Z0-9_-]+)/
        );

      if (matchFolder) {
        folderId =
          matchFolder[1];
      }

      if (folderId.includes('?')) {
        folderId =
          folderId.split('?')[0];
      }

      console.log(
        '[Google Drive] Folder ID:',
        folderId
      );

      // -------------------------------------------------------
      // Google API key
      // -------------------------------------------------------

      const apiKey =
        process.env.GOOGLE_DRIVE_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error(
          '[Google Drive] API key missing'
        );

        return res.status(500).json({
          success: false,
          error:
            'Google Drive API key is missing. Configure GOOGLE_DRIVE_API_KEY in Render environment variables.',
        });
      }

      // -------------------------------------------------------
      // Recursive Drive fetch
      // -------------------------------------------------------

      async function fetchDriveTree(
        fId: string,
        currentPath = '',
        depth = 0
      ): Promise<any[]> {
        if (depth > 5) {
          console.warn(
            '[Google Drive] Maximum folder depth reached:',
            currentPath
          );

          return [];
        }

        const query =
          encodeURIComponent(
            `'${fId}' in parents and trashed=false`
          );

        const fields =
          encodeURIComponent(
            'files(id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime,size)'
          );

        const apiUrl =
          `https://www.googleapis.com/drive/v3/files` +
          `?q=${query}` +
          `&fields=${fields}` +
          `&pageSize=1000` +
          `&key=${apiKey}`;

        console.log(
          `[Google Drive] Fetching depth ${depth}:`,
          currentPath || 'Root'
        );

        const response =
          await fetch(apiUrl);

        if (!response.ok) {
          const errorBody =
            await response.text();

          console.error(
            '[Google Drive] API Error:',
            response.status,
            errorBody
          );

          throw new Error(
            `Google Drive API error (${response.status}). ` +
              `Make sure the folder is public ("Anyone with the link can view"). ` +
              `Details: ${errorBody}`
          );
        }

        const json =
          await response.json();

        const items =
          json.files || [];

        const collected: any[] = [];

        for (const item of items) {
          // ---------------------------------------------------
          // Folder
          // ---------------------------------------------------

          if (
            item.mimeType ===
            'application/vnd.google-apps.folder'
          ) {
            const subPath =
              currentPath
                ? `${currentPath}/${item.name}`
                : item.name;

            const children =
              await fetchDriveTree(
                item.id,
                subPath,
                depth + 1
              );

            collected.push(
              ...children
            );
          }

          // ---------------------------------------------------
          // File
          // ---------------------------------------------------

          else {
            collected.push({
              ...item,
              subfolderPath:
                currentPath || 'Root',
            });
          }
        }

        return collected;
      }

      // -------------------------------------------------------
      // Fetch files
      // -------------------------------------------------------

      const rawDriveItems =
        await fetchDriveTree(
          folderId
        );

      console.log(
        `[Google Drive] Total files found: ${rawDriveItems.length}`
      );

      // =======================================================
      // PROCESS FILES
      // =======================================================

      const processedFiles =
        rawDriveItems.map(
          (file) => {
            const isPdf =
              file.mimeType ===
                'application/pdf' ||
              String(file.name || '')
                .toLowerCase()
                .endsWith('.pdf');

            const detectedSem =
              mapSubfolderToSemester(
                file.subfolderPath,
                semester || 'SEM_1'
              );

            // -------------------------------------------------
            // Non PDF
            // -------------------------------------------------

            if (!isPdf) {
              return {
                id: file.id,
                driveFileId: file.id,
                name: file.name,
                subfolderPath:
                  file.subfolderPath,
                categoryCode: null,
                categoryNo: 1,
                title: file.name,
                webViewLink:
                  file.webViewLink ||
                  `https://drive.google.com/file/d/${file.id}/view`,
                mimeType:
                  file.mimeType ||
                  'application/octet-stream',
                semester: detectedSem,
                status:
                  'skipped_not_pdf',
                hasNamingConvention:
                  false,
                modifiedTime:
                  file.modifiedTime ||
                  file.createdTime,
              };
            }

            // -------------------------------------------------
            // PDF processing
            // -------------------------------------------------

            const cleanName =
              file.name || '';

            const nameNoExt =
              cleanName
                .replace(
                  /\.pdf$/i,
                  ''
                )
                .trim();

            let categoryCode:
              string | null = null;

            let categoryNo = 1;

            let title =
              nameNoExt;

            let hasConvention =
              false;

            let status =
              'imported';

            let finalSemester =
              mapSubfolderToSemester(
                file.subfolderPath,
                semester || 'SEM_1'
              );

            // -------------------------------------------------
            // New format
            //
            // SEM-01_CAT-06_Title.pdf
            // SEM01_CAT06_Title.pdf
            // -------------------------------------------------

            const fullMatch =
              nameNoExt.match(
                /^SEM[_\s-]*0?([1-8])[_\s-]+CAT[_\s-]*0?([1-9]|1[0-5])[_\s-]+(.+)$/i
              );

            if (fullMatch) {
              const semNum =
                fullMatch[1];

              const catNum =
                parseInt(
                  fullMatch[2],
                  10
                );

              finalSemester =
                `SEM_${semNum}`;

              categoryCode =
                `CAT-${catNum
                  .toString()
                  .padStart(2, '0')}`;

              categoryNo =
                catNum;

              let rawTitle =
                fullMatch[3].replace(
                  /_[0-9]{6,8}$/,
                  ''
                );

              if (
                !rawTitle.includes(' ') &&
                !rawTitle.includes('_') &&
                !rawTitle.includes('-')
              ) {
                rawTitle =
                  rawTitle.replace(
                    /([a-z])([A-Z])/g,
                    '$1 $2'
                  );
              } else {
                rawTitle =
                  rawTitle.replace(
                    /[_-]/g,
                    ' '
                  );
              }

              title =
                rawTitle.trim();

              hasConvention =
                true;

              status =
                'imported';
            }

            // -------------------------------------------------
            // Legacy format
            //
            // CAT-06_Title.pdf
            // -------------------------------------------------

            else {
              const catMatch =
                nameNoExt.match(
                  /^CAT[_\s-]*0?([1-9]|1[0-5])[_\s-]+(.+)$/i
                );

              if (catMatch) {
                const catNum =
                  parseInt(
                    catMatch[1],
                    10
                  );

                categoryCode =
                  `CAT-${catNum
                    .toString()
                    .padStart(2, '0')}`;

                categoryNo =
                  catNum;

                let rawTitle =
                  catMatch[2].replace(
                    /_[0-9]{6,8}$/,
                    ''
                  );

                if (
                  !rawTitle.includes(' ') &&
                  !rawTitle.includes('_') &&
                  !rawTitle.includes('-')
                ) {
                  rawTitle =
                    rawTitle.replace(
                      /([a-z])([A-Z])/g,
                      '$1 $2'
                    );
                } else {
                  rawTitle =
                    rawTitle.replace(
                      /[_-]/g,
                      ' '
                    );
                }

                title =
                  rawTitle.trim();

                hasConvention =
                  true;

                status =
                  'imported';
              }

              // ------------------------------------------------
              // Invalid naming convention
              // ------------------------------------------------

              else {
                if (
                  !title.includes(' ') &&
                  !title.includes('_') &&
                  !title.includes('-')
                ) {
                  title =
                    title.replace(
                      /([a-z])([A-Z])/g,
                      '$1 $2'
                    );
                } else {
                  title =
                    title.replace(
                      /[_-]/g,
                      ' '
                    );
                }

                title =
                  title.trim();

                status =
                  'naming_error';
              }
            }

            return {
              id: file.id,
              driveFileId: file.id,
              name: file.name,
              subfolderPath:
                file.subfolderPath,
              categoryCode,
              categoryNo,
              title:
                title ||
                'Activity Certificate',
              webViewLink:
                file.webViewLink ||
                `https://drive.google.com/file/d/${file.id}/view`,
              mimeType:
                'application/pdf',
              semester:
                finalSemester,
              status,
              hasNamingConvention:
                hasConvention,
              modifiedTime:
                file.modifiedTime ||
                file.createdTime,
            };
          }
        );

      return res.json({
        success: true,
        folderId,
        semester:
          semester || 'SEM_1',
        count:
          processedFiles.length,
        files:
          processedFiles,
      });
    } catch (err: any) {
      console.error(
        '[Google Drive] Error:',
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err?.message ||
          'Failed to fetch Google Drive folder files.',
      });
    }
  }
);


// =========================================================
// SEMESTER DETECTION
// =========================================================

function mapSubfolderToSemester(
  subfolderPath: string,
  defaultSemester = 'SEM_1'
): string {
  if (!subfolderPath) {
    return defaultSemester;
  }

  const upper =
    subfolderPath.toUpperCase();

  const semesterPatterns = [
    {
      semester: 'SEM_1',
      patterns: [
        'SEM 1',
        'SEM-1',
        'SEM_1',
        'SEMESTER 1',
        'SEMESTER-1',
        'SEMESTER_1',
        'SEM01',
        'SEM 01',
        '1ST SEM',
        'SEM I',
      ],
    },
    {
      semester: 'SEM_2',
      patterns: [
        'SEM 2',
        'SEM-2',
        'SEM_2',
        'SEMESTER 2',
        'SEMESTER-2',
        'SEMESTER_2',
        'SEM02',
        'SEM 02',
        '2ND SEM',
        'SEM II',
      ],
    },
    {
      semester: 'SEM_3',
      patterns: [
        'SEM 3',
        'SEM-3',
        'SEM_3',
        'SEMESTER 3',
        'SEMESTER-3',
        'SEMESTER_3',
        'SEM03',
        'SEM 03',
        '3RD SEM',
        'SEM III',
      ],
    },
    {
      semester: 'SEM_4',
      patterns: [
        'SEM 4',
        'SEM-4',
        'SEM_4',
        'SEMESTER 4',
        'SEMESTER-4',
        'SEMESTER_4',
        'SEM04',
        'SEM 04',
        '4TH SEM',
        'SEM IV',
      ],
    },
    {
      semester: 'SEM_5',
      patterns: [
        'SEM 5',
        'SEM-5',
        'SEM_5',
        'SEMESTER 5',
        'SEMESTER-5',
        'SEMESTER_5',
        'SEM05',
        'SEM 05',
        '5TH SEM',
        'SEM V',
      ],
    },
    {
      semester: 'SEM_6',
      patterns: [
        'SEM 6',
        'SEM-6',
        'SEM_6',
        'SEMESTER 6',
        'SEMESTER-6',
        'SEMESTER_6',
        'SEM06',
        'SEM 06',
        '6TH SEM',
        'SEM VI',
      ],
    },
    {
      semester: 'SEM_7',
      patterns: [
        'SEM 7',
        'SEM-7',
        'SEM_7',
        'SEMESTER 7',
        'SEMESTER-7',
        'SEMESTER_7',
        'SEM07',
        'SEM 07',
        '7TH SEM',
        'SEM VII',
      ],
    },
    {
      semester: 'SEM_8',
      patterns: [
        'SEM 8',
        'SEM-8',
        'SEM_8',
        'SEMESTER 8',
        'SEMESTER-8',
        'SEMESTER_8',
        'SEM08',
        'SEM 08',
        '8TH SEM',
        'SEM VIII',
      ],
    },
  ];

  for (const item of semesterPatterns) {
    if (
      item.patterns.some(
        (pattern) =>
          upper.includes(pattern)
      )
    ) {
      return item.semester;
    }
  }

  return defaultSemester;
}


// =========================================================
// GEMINI CERTIFICATE CLASSIFICATION
// =========================================================

app.post(
  '/api/gemini/classify-certificate',
  async (req, res) => {
    try {
      const {
        fileData,
        mimeType,
        fileName,
        fileText,
        certificateId,
      } = req.body;

      if (
        !fileData &&
        !fileName &&
        !fileText
      ) {
        return res.status(400).json({
          success: false,
          error:
            'At least one of "fileData", "fileName", or "fileText" is required.',
        });
      }

      const {
        classifyCertificatePdf,
      } = await import(
        './src/services/certificateAiService'
      );

      const classification =
        await classifyCertificatePdf({
          fileData,
          mimeType,
          fileName,
          fileText,
        });

      const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL;

      const serviceRoleKey =
        process.env
          .SUPABASE_SERVICE_ROLE_KEY;

      if (
        certificateId &&
        supabaseUrl &&
        serviceRoleKey
      ) {
        try {
          const supabaseAdmin =
            createClient(
              supabaseUrl,
              serviceRoleKey,
              {
                auth: {
                  autoRefreshToken:
                    false,
                  persistSession:
                    false,
                },
              }
            );

          const categoryCode =
            classification.category !==
            'unrecognized'
              ? classification.category
              : null;

          await supabaseAdmin.rpc(
            'apply_ai_classification',
            {
              p_certificate_id:
                certificateId,
              p_raw_response:
                classification,
              p_category_code:
                categoryCode,
              p_title:
                classification.title,
              p_reason:
                classification.reason,
            }
          );
        } catch (dbErr) {
          console.warn(
            '[Gemini] Database RPC warning:',
            dbErr
          );
        }
      }

      return res.json({
        success: true,
        data: classification,
      });
    } catch (err: any) {
      console.error(
        '[Gemini] Classification error:',
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err?.message ||
          'Failed to classify certificate with Gemini AI.',
      });
    }
  }
);


// =========================================================
// EMAIL VERIFICATION
// =========================================================

const verificationStore =
  new Map<
    string,
    {
      code: string;
      name: string;
      expiresAt: number;
      verified: boolean;
    }
  >();


// ---------------------------------------------------------
// SEND VERIFICATION
// ---------------------------------------------------------

app.post(
  '/api/auth/send-verification',
  async (req, res) => {
    try {
      const {
        email,
        name,
      } = req.body;

      if (
        !email ||
        typeof email !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Email is required',
        });
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const code =
        Math.floor(
          100000 +
            Math.random() * 900000
        ).toString();

      const expiresAt =
        Date.now() +
        10 * 60 * 1000;

      verificationStore.set(
        cleanEmail,
        {
          code,
          name:
            name ||
            cleanEmail.split('@')[0],
          expiresAt,
          verified: false,
        }
      );

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#312e81;padding:20px;text-align:center;">
            <h2 style="color:white;margin:0;">
              Thakur College of Engineering & Technology
            </h2>
          </div>

          <div style="padding:25px;text-align:center;">
            <h3>Verify Your Email Address</h3>

            <p>
              Hello <strong>${name || 'TCET Student'}</strong>,
            </p>

            <p>
              Use the following 6-digit verification code:
            </p>

            <div style="
              font-size:36px;
              font-weight:bold;
              letter-spacing:8px;
              padding:20px;
              background:#f1f5f9;
              display:inline-block;
            ">
              ${code}
            </div>

            <p>
              This code is valid for 10 minutes.
            </p>
          </div>
        </div>
      `;

      const result =
        enqueueEmail({
          to: cleanEmail,
          subject:
            `[TCET Verification] ${code} is your email verification code`,
          html: emailHtml,
          templateType:
            'verification_code',
          idempotencyKey:
            `verif_code_${cleanEmail}_${Date.now()}`,
        });

      return res.json({
        success: true,
        message:
          'Verification code dispatched',
        email: cleanEmail,
        jobId:
          result.jobId,
      });
    } catch (err: any) {
      console.error(
        '[Email Verification] Error:',
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err?.message ||
          'Failed to send verification code',
      });
    }
  }
);


// ---------------------------------------------------------
// VERIFY CODE
// ---------------------------------------------------------

app.post(
  '/api/auth/verify-code',
  async (req, res) => {
    try {
      const {
        email,
        code,
      } = req.body;

      if (
        !email ||
        !code
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Email and verification code are required',
        });
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const inputCode =
        String(code).trim();

      const stored =
        verificationStore.get(
          cleanEmail
        );

      if (!stored) {
        return res.status(400).json({
          success: false,
          error:
            'No active verification code found for this email.',
        });
      }

      if (
        Date.now() >
        stored.expiresAt
      ) {
        verificationStore.delete(
          cleanEmail
        );

        return res.status(400).json({
          success: false,
          error:
            'Verification code has expired.',
        });
      }

      if (
        stored.code !==
        inputCode
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid verification code.',
        });
      }

      stored.verified =
        true;

      return res.json({
        success: true,
        message:
          'Email verified successfully',
        email:
          cleanEmail,
      });
    } catch (err: any) {
      console.error(
        '[Email Verification] Verify error:',
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err?.message ||
          'Failed to verify code',
      });
    }
  }
);


// ---------------------------------------------------------
// CHECK VERIFICATION
// ---------------------------------------------------------

app.post(
  '/api/auth/check-verification-status',
  (req, res) => {
    const { email } =
      req.body;

    if (!email) {
      return res.json({
        verified: false,
      });
    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    const stored =
      verificationStore.get(
        cleanEmail
      );

    return res.json({
      verified:
        Boolean(
          stored?.verified
        ),
    });
  }
);


// =========================================================
// EMAIL SEND
// =========================================================

app.post(
  '/api/email/send',
  (req, res) => {
    try {
      const {
        to,
        subject,
        html,
        text,
        from,
        idempotencyKey,
        templateType,
        metadata,
      } = req.body;

      if (
        !to ||
        !subject ||
        !html
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Fields "to", "subject", and "html" are required.',
        });
      }

      const result =
        enqueueEmail({
          to,
          subject,
          html,
          text,
          from,
          idempotencyKey,
          templateType,
          metadata,
        });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error(
        '[Email] Send error:',
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err?.message ||
          'Server error queueing email',
      });
    }
  }
);


// =========================================================
// EMAIL BATCH
// =========================================================

app.post(
  '/api/email/send-batch',
  (req, res) => {
    try {
      const {
        emails,
      } = req.body;

      if (
        !Array.isArray(emails) ||
        emails.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Array "emails" is required.',
        });
      }

      const results =
        emails.map(
          (opts) =>
            enqueueEmail({
              to: opts.to,
              subject:
                opts.subject,
              html:
                opts.html,
              text:
                opts.text,
              from:
                opts.from,
              idempotencyKey:
                opts.idempotencyKey,
              templateType:
                opts.templateType,
              metadata:
                opts.metadata,
            })
        );

      return res.json({
        success: true,
        count:
          results.length,
        jobs:
          results,
      });
    } catch (err: any) {
      console.error(
        '[Email] Batch error:',
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err?.message ||
          'Server error queueing batch emails',
      });
    }
  }
);


// =========================================================
// EMAIL STATUS
// =========================================================

app.get(
  '/api/email/status/:jobId',
  (req, res) => {
    const job =
      getJobStatus(
        req.params.jobId
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        error:
          'Job not found',
      });
    }

    return res.json({
      id: job.id,
      status: job.status,
      attempts:
        job.attempts,
      createdAt:
        job.createdAt,
      messageId:
        job.messageId,
      error:
        job.error,
    });
  }
);


// =========================================================
// EMAIL HEALTH
// =========================================================

app.get(
  '/api/email/health',
  (_req, res) => {
    return res.json(
      getEmailServiceHealth()
    );
  }
);


// =========================================================
// CHECK USER EXISTS
// =========================================================

app.post(
  '/api/check-user-exists',
  async (req, res) => {
    try {
      const { email } =
        req.body;

      if (
        !email ||
        typeof email !== 'string'
      ) {
        return res.status(400).json({
          exists: false,
          error:
            'Email is required',
        });
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL;

      const serviceRoleKey =
        process.env
          .SUPABASE_SERVICE_ROLE_KEY;

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        return res.json({
          exists: false,
          message:
            'Supabase credentials not configured',
        });
      }

      const supabaseAdmin =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,
              persistSession:
                false,
            },
          }
        );

      let exists =
        false;

      // -----------------------------------------------------
      // Supabase Auth
      // -----------------------------------------------------

      try {
        const {
          data,
          error,
        } =
          await supabaseAdmin
            .auth.admin.listUsers();

        if (
          !error &&
          data?.users &&
          Array.isArray(
            data.users
          )
        ) {
          exists =
            data.users.some(
              (user: any) =>
                user.email
                  ?.toLowerCase() ===
                cleanEmail
            );
        }
      } catch (adminErr) {
        console.warn(
          '[Supabase] listUsers warning:',
          adminErr
        );
      }

      // -----------------------------------------------------
      // users table fallback
      // -----------------------------------------------------

      if (!exists) {
        const {
          data,
          error,
        } =
          await supabaseAdmin
            .from('users')
            .select('email')
            .eq(
              'email',
              cleanEmail
            )
            .maybeSingle();

        if (
          !error &&
          data
        ) {
          exists =
            true;
        }
      }

      return res.json({
        exists,
      });
    } catch (err: any) {
      console.error(
        '[Supabase] User check error:',
        err
      );

      return res.status(500).json({
        exists: false,
        error:
          err?.message ||
          'Failed to check user',
      });
    }
  }
);


// =========================================================
// FRONTEND / VITE
// =========================================================

if (!isProduction) {
  console.log(
    '[Server] Starting Vite development middleware...'
  );

  const {
    createServer:
      createViteServer,
  } = await import(
    'vite'
  );

  const vite =
    await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });

  app.use(
    vite.middlewares
  );
} else {
  const distPath =
    path.resolve(
      process.cwd(),
      'dist'
    );

  console.log(
    '[Server] Production static path:',
    distPath
  );

  app.use(
    express.static(
      distPath
    )
  );

  // ---------------------------------------------------------
  // SPA fallback
  //
  // IMPORTANT:
  // API routes are defined above this.
  // Therefore /api/... requests will not
  // accidentally receive index.html.
  // ---------------------------------------------------------

  app.get(
    '*',
    (_req, res) => {
      res.sendFile(
        path.join(
          distPath,
          'index.html'
        )
      );
    }
  );
}


// =========================================================
// START SERVER
// =========================================================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      '=========================================='
    );

    console.log(
      'TCET AICTE Server Started'
    );

    console.log(
      `PORT: ${PORT}`
    );

    console.log(
      `ENV: ${
        process.env.NODE_ENV ||
        'development'
      }`
    );

    console.log(
      `Frontend URL: ${FRONTEND_URL}`
    );

    console.log(
      `Google Drive API: ${
        process.env.GOOGLE_DRIVE_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_API_KEY
          ? 'CONFIGURED'
          : 'MISSING'
      }`
    );

    console.log(
      `Gemini API: ${
        process.env.GEMINI_API_KEY
          ? 'CONFIGURED'
          : 'MISSING'
      }`
    );

    console.log(
      `Supabase URL: ${
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL
          ? 'CONFIGURED'
          : 'MISSING'
      }`
    );

    console.log(
      `Supabase Service Role: ${
        process.env
          .SUPABASE_SERVICE_ROLE_KEY
          ? 'CONFIGURED'
          : 'MISSING'
      }`
    );

    console.log(
      '=========================================='
    );
  }
);


// =========================================================
// FATAL ERROR HANDLER
// =========================================================

process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '[FATAL] Uncaught exception:',
      error
    );
  }
);

process.on(
  'unhandledRejection',
  (reason) => {
    console.error(
      '[FATAL] Unhandled rejection:',
      reason
    );
  }
);