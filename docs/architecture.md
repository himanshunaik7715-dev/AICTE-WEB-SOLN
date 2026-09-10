# TCET AICTE portal — current architecture

Status: initial audit, before implementation changes. See [audit findings](audit/initial-audit.md).

```text
Browser / Vercel
  React + GoogleOAuthProvider + App.tsx
    |-- Supabase Auth: Google ID token or password, persisted session
    |-- Supabase REST: users, admins, submissions (RLS is the security boundary)
    |-- Supabase Realtime: full-table refresh callbacks
    |-- Express / Render
         |-- verify Supabase bearer token
         |-- service-role bootstrap and superadmin counts
         |-- Google Drive public-folder listing using server API key
         |-- Gemini certificate classification using server API key
    |-- browser-generated XLSX / PDF exports

Vercel api/ contains separate bootstrap/count/approve/reject handlers.
The frontend's default production API base is Render.
```

## Repository map

| Location | Responsibility |
|---|---|
| `src/main.tsx` | React root, StrictMode, Google provider, global CSS |
| `src/App.tsx` | In-memory routing, session restoration, shared dashboard state, all submission actions |
| `src/components/AuthPage.tsx`, `AuthModal.tsx`, `SuperAdminAuthPage.tsx` | Google/password sign-in and overlapping onboarding implementations |
| `src/components/StudentProfileSetup.tsx` | UID parsing, ERP/contact validation, student onboarding |
| `StudentDashboard`, `CRReviewPortal`, `TGMDashboard`, `SuperAdminDashboard` | Role pages selected by `currentRole` |
| `AdminPortal.tsx` | Legacy combined administration component; no rendered caller found |
| `DriveFetchModal`, `SemesterFolderViewModal`, `UploadCertificateModal`, `SubmissionDetailsModal` | Import, submit, resubmit and review dialogs |
| `src/services/authService.ts` | Sign-in, profile completion, requests, password login, logout |
| `src/services/dbService.ts` | Supabase CRUD, global in-memory caches, listeners and Realtime |
| `src/services/driveService.ts` | Drive URL/name parsing and Render folder-listing calls; unused simulated upload |
| `src/services/certificateAiService.ts` | Server-used Gemini client, prompt and JSON parsing |
| `src/utils/` | UID/profile validation and XLSX/PDF generation |
| `src/constants/aicteData.ts`, `src/types.ts` | Categories, semester targets, domain types |
| `src/lib/` | Supabase singleton and API origin configuration |
| `server.ts`, `api/` | Express application and separately deployed Vercel handlers |
| `scripts/` | Seed/repair tools and password-login utility; seed scripts can reset credentials |
| `supabase-schema.sql` | Proposed baseline with destructive cleanup and security definitions, not live-schema authority |
| `public/`, `src/assets/images/` | Existing logo assets; UI currently uses `/tcet-logo.ico` and `/TCET IOT LOGO.png` |

## Identity and routing

Stored role values are `student`, `cr`, `admin` (TGM), `superadmin`. They are not separate role tables. A `users` row combines identity, academic classification, mentor relationships and privilege state. `admins` combines faculty whitelist and privileged-account requests. Approval state is duplicated across the two.

The application has no routing library. `currentRole` selects a dashboard; pathname/hash substring detection identifies superadmin entry. Header callbacks can change this state. It is presentation state, not authorization. Backend token checks and database RLS must remain authoritative.

Returning users call `getUser()`, lookup `users` by email and compare IDs. Students receive a second profile query and a completeness check. Role resolution happens before dashboard subscriptions, but `sessionRestoring` does not gate rendering. New Google users can invoke backend whitelist bootstrap before onboarding. Password login is offered for CR and superadmin. TGMs/students use Google sign-in.

## Submission workflow

Drive imports and manual certificate metadata enter the submission system. Application states include imported/naming error/skipped files, then explicit student submission for CR review. CR validation moves to `pending_admin`; TGM verification moves to `approved`. CR/TGM may request resubmission, and TGM may reject. Frontend handlers submit status/flag updates directly to Supabase. The SQL insert trigger always changes a new record to `imported`, which can differ from the frontend's requested initial status. It must be compared with the actual installed trigger.

Points are stored on submissions and summed by the frontend for approved records; there is no independent immutable points ledger. Calculations differ across manual and AI flows and do not constitute a secure server authority.

## Deployment and backend routes

| Route | Express | Vercel file | Current purpose |
|---|---|---|---|
| GET `/health` | Yes | No | Backend process health, no DB validation |
| POST `/api/auth/bootstrap-profile` | Yes | Yes | Whitelisted Google identity to application profile |
| GET `/api/superadmin/dashboard-counts` | Yes | Yes | Counts and pending requests |
| POST `/api/superadmin/approve-request` | No | Yes | Privileged approval; Render probe returns 404 |
| POST `/api/superadmin/reject-request` | No | Yes | Privileged rejection; Render probe returns 404 |
| POST `/api/drive/fetch-folder-files` | Yes | No | Public Drive folder recursive listing |
| POST `/api/gemini/classify-certificate` | Yes | No | Certificate classification |

Express uses an institutional-email bearer-token middleware, allowlisted CORS origins and a 20 MB JSON limit. CORS is not authorization. Superadmin routes additionally check profile/whitelist identities. Request exceptions and downstream errors do not use a uniform error contract. In production Express also serves `dist`; unknown GET paths reach the SPA fallback. Vercel/Render configuration files and cron definitions were not found.

## Environment inventory (names only)

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`, optional `VITE_API_BASE_URL`. Backend: `SUPABASE_URL` / fallback `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY` / fallback `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_DRIVE_API_KEY` / `GOOGLE_API_KEY` / `GEMINI_API_KEY`, `GEMINI_API_KEY`, `PORT`, `NODE_ENV`, `FRONTEND_URL`. Development: `DISABLE_HMR`.

The supplied local environment includes the frontend URL/key/client ID, backend service key, Drive/Gemini keys, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `VITE_GOOGLE_CLIENT_SECRET`. No Resend implementation was found. The client secret is not referenced by source and must be kept outside the `VITE_` namespace. Values are intentionally not documented. Current tracked-file inspection did not show `.env` or credential JSON files; this does not audit all Git history or hosted environment settings.
