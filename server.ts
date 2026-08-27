import express from 'express';
import path from 'path';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

const authClient = (() => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? createClient(url, anonKey) : null;
})();

const serviceClient = (() => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
})();

const requireAuth: express.RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!authClient || !token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email.toLowerCase().endsWith('@tcetmumbai.in')) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
  res.locals.user = data.user;
  next();
};

app.post('/api/auth/bootstrap-profile', requireAuth, async (_req, res) => {
  if (!serviceClient) {
    return res.status(503).json({ success: false, error: 'Server authentication is not configured' });
  }

  const authUser = res.locals.user;
  const email = String(authUser.email).trim().toLowerCase();
  const { data: whitelist, error: whitelistError } = await serviceClient
    .from('admins')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (whitelistError || !whitelist || !whitelist.isWhitelisted || whitelist.approvalStatus !== 'approved') {
    return res.status(403).json({ success: false, error: 'Faculty account is not whitelisted' });
  }

  const { data: existing } = await serviceClient
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existing && existing.id !== authUser.id) {
    const { error } = await serviceClient.from('users').update({ id: authUser.id }).eq('email', email);
    if (error) return res.status(500).json({ success: false, error: error.message });
  }

  const profile = {
    id: authUser.id,
    name: whitelist.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0],
    email,
    role:
      existing?.role === 'superadmin' ||
      authUser.user_metadata?.seededRole === 'superadmin' ||
      String(whitelist.designation || '').toLowerCase().includes('super admin')
        ? 'superadmin'
        : 'admin',
    rollNo: 'FAC',
    erpNo: `FAC-${email.split('@')[0].toUpperCase()}`,
    department: whitelist.department || 'Internet of Things (IoT)',
    division: existing?.division || '',
    academicBatch: existing?.academicBatch || '',
    tgmApprovalStatus: 'approved',
    customRole: existing?.customRole,
  };
  const { data, error } = await serviceClient.from('users').upsert(profile).select('*').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  return res.json({ success: true, recognized: true, profile: data });
});

app.get('/api/superadmin/dashboard-counts', requireAuth, async (_req, res) => {
  if (!serviceClient) {
    return res.status(503).json({ success: false, error: 'Server authentication is not configured' });
  }

  const authUser = res.locals.user;
  const email = String(authUser.email).trim().toLowerCase();
  const [{ data: profile }, { data: whitelist }] = await Promise.all([
    serviceClient.from('users').select('id,role').eq('email', email).maybeSingle(),
    serviceClient
      .from('admins')
      .select('id,designation,isWhitelisted,approvalStatus')
      .eq('email', email)
      .maybeSingle(),
  ]);

  const isApprovedSuperadmin =
    profile?.id === authUser.id &&
    profile.role === 'superadmin' &&
    whitelist?.id === authUser.id &&
    whitelist.isWhitelisted &&
    whitelist.approvalStatus === 'approved';

  if (!isApprovedSuperadmin) {
    return res.status(403).json({ success: false, error: 'Approved Superadmin access is required' });
  }

  const [
    { data: students, error: studentsError },
    { data: faculty, error: facultyError },
    { data: adminRows, error: adminsError },
  ] = await Promise.all([
    serviceClient.from('users').select('id,tgmId,tgmName').eq('role', 'student'),
    serviceClient.from('users').select('id,name,email,role,department,tgmApprovalStatus').in('role', ['admin', 'superadmin']),
    serviceClient.from('admins').select('id,name,email,department,designation,addedAt,addedBy,approvalStatus,isWhitelisted'),
  ]);
  if (studentsError || facultyError || adminsError) {
    return res.status(500).json({
      success: false,
      error: studentsError?.message || facultyError?.message || adminsError?.message || 'Unable to load dashboard data',
    });
  }

  const assignedStudentCounts: Record<string, number> = {};
  for (const tgm of (faculty || []).filter((user) => user.role === 'admin')) {
    const normalizedName = String(tgm.name || '').trim().toLowerCase();
    assignedStudentCounts[tgm.id] = (students || []).filter((student) =>
      student.tgmId === tgm.id ||
      (!student.tgmId && Boolean(student.tgmName) && String(student.tgmName).toLowerCase().includes(normalizedName)),
    ).length;
  }

  const pendingRequests = new Map<string, any>();
  for (const user of (faculty || []).filter((row) => row.tgmApprovalStatus === 'pending')) {
    if (user.email.toLowerCase() === 'superadmin@tcetmumbai.in') continue;
    pendingRequests.set(user.email.toLowerCase(), {
      id: user.id, name: user.name, email: user.email,
      department: user.department || 'Internet of Things (IoT)',
      designation: user.role === 'superadmin' ? 'Super Admin (Applicant)' : 'Teacher Guardian Mentor (TGM)',
      date: 'Recent Sign-Up Request', role: user.role,
    });
  }
  for (const row of (adminRows || []).filter((admin) =>
    admin.approvalStatus === 'pending' ||
    (admin.approvalStatus !== 'rejected' && !admin.isWhitelisted && String(admin.addedBy || '').includes('Request')),
  )) {
    const isSuperadmin = String(row.designation || '').toLowerCase().includes('super admin') || String(row.addedBy || '').toLowerCase().includes('super admin');
    pendingRequests.set(row.email.toLowerCase(), {
      id: row.id, name: row.name, email: row.email,
      department: row.department || 'Internet of Things (IoT)',
      designation: row.designation || (isSuperadmin ? 'Super Admin (Applicant)' : 'Teacher Guardian Mentor (TGM)'),
      date: row.addedAt || 'Recent Sign-Up Request', role: isSuperadmin ? 'superadmin' : 'admin',
    });
  }

  return res.json({
    success: true,
    registeredStudents: students?.length || 0,
    studentsWithSelectedTgm: (students || []).filter((student) => Boolean(student.tgmId)).length,
    assignedStudentCounts,
    pendingRequests: Array.from(pendingRequests.values()),
  });
});


// =========================================================
// GOOGLE DRIVE
// =========================================================

app.post(
  '/api/drive/fetch-folder-files',
  requireAuth,
  async (req, res) => {
    try {
      const {
        folderUrlOrId,
        semester,
      } = req.body;

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
                /^SEM[_\s-]*0?([1-8])[_\s-]+CAT[_\s-]*0?([1-9]|1[0-6])[_\s-]+(.+)$/i
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
                  /^CAT[_\s-]*0?([1-9]|1[0-6])[_\s-]+(.+)$/i
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
  requireAuth,
  async (req, res) => {
    try {
      const {
        fileData,
        mimeType,
        fileName,
        fileText,
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
