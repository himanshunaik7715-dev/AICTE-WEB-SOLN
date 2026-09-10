# TCET AICTE Activity Points Portal

A responsive activity-points management portal for Thakur College of Engineering and Technology. Students can submit activity certificates, while CRs, TGMs/faculty, and super administrators review and manage the approval workflow.

## Features

- Google and Supabase authentication
- Student profile onboarding and certificate submission
- Google Drive certificate import
- CR and TGM review workflow
- Re-upload workflow for rejected submissions
- Faculty, CR, and super-admin dashboards
- Responsive layouts for phones, tablets, and desktops
- Supabase Row Level Security policies

## Technology

- React 19 and TypeScript
- Vite and Tailwind CSS 4
- Express
- Supabase
- Google OAuth, Drive API, and Gemini

## Local setup

Requirements: Node.js 20 or newer and npm.

1. Clone the repository and enter its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and configure the required variables listed below.
4. For an existing database, follow `docs/deployment-status.md`. Never run `supabase-schema.sql` against production: it is a destructive legacy bootstrap used only by the isolated database test. Apply the reviewed numbered migrations in order after backup and live schema inspection.
5. Start the development server:

   ```bash
   npm run dev
   ```

The application runs on `http://localhost:3000` by default.

## Environment variables

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_API_BASE_URL=https://your-backend.example.com

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

GOOGLE_DRIVE_API_KEY=your-google-drive-api-key
GEMINI_API_KEY=your-gemini-api-key

FRONTEND_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

`SUPABASE_SERVICE_ROLE_KEY` must remain server-side. Never expose it through a `VITE_` variable or commit it to Git.

`VITE_API_BASE_URL` is the public Express backend origin used by a separately deployed frontend. It can be omitted locally, where API requests use the same origin.

## Commands

```bash
npm run dev      # Run the Express and Vite development server
npm run lint     # Run the TypeScript type check
npm run build    # Create the production frontend and server bundles
npm start        # Run the production bundle
npm run preview  # Preview the Vite frontend build
```

## Production deployment

1. Configure all production environment variables on the hosting provider.
2. Set `NODE_ENV=production` and `FRONTEND_URL` to the public application URL.
3. Run `supabase-schema.sql` against the intended production database after taking a backup.
4. Build with `npm run build`.
5. Start with `npm start`.

The server provides a health check at `/health`.

## Security notes

- `.env` files and credential JSON files are ignored by Git.
- Anonymous database access is intentionally restricted.
- The Supabase service-role key is used only by the backend.
- Only approved institutional accounts should receive elevated roles.

## Repository structure

```text
src/components/       Pages, dashboards, forms, and modals
src/services/         Authentication, database, Drive, and AI services
src/lib/              Shared client configuration
scripts/              Administrative setup and diagnostic utilities
server.ts             Express server and protected backend routes
supabase-schema.sql   Production database schema and security policies
```
