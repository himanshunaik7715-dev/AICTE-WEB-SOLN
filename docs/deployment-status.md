# Implementation and deployment status

Production Supabase migrations 001–004 were applied on 2026-09-09 after live catalog inspection. The frontend and shared Express API are deployed to https://tcetaicte.vercel.app (deployment `dpl_6ZmSq2ny3Ee3N6GSMkkfsVm7Sw5e`). No GitHub push was made. Earlier audit/design documents describe the baseline; this document supersedes their unapplied-migration status.

Before migration, protected snapshots of all 72 users, 9 admins and 74 submissions plus existing functions, policies and grants were created in `portal_backup_20260909`. Bidirectional row comparisons verified the snapshots; post-migration comparisons proved every original row unchanged. These same-database snapshots are not an independent disaster-recovery backup.

Live partitions in `portal_private`: `students_2025_2029_iot_div_a_s3` contains 25 students; `students_2025_2029_iot_div_b_s1` contains 31. The 2030–2034 A partition contains the remaining student. Legacy 2023/2024 scopes are provisioned without deleting anything. All four migration versions were verified in `portal_migrations`.

## Database and authorization

Apply migrations 001 through 004 in order, once, after inspecting the live catalog with `scripts/inspect-database.sql`, verifying a restorable backup, and resolving schema conflicts. Do not run the destructive legacy `supabase-schema.sql` in production. Each migration is transactional. Reapplying a migration is not supported.

`academic_scopes` identifies batch, department, course and division. `student_registry` maintains stable student identity; `students` is partitioned by scope into physical tables in `portal_private`. Find each child's actual name in `academic_scopes.partition_name`. The public parent can display both divisions; its underlying physical storage is separate. `users` remains the shared identity/compatibility table so existing IDs and submissions survive. Teachers, CRs and super administrators also have role-specific tables.

Composite foreign keys enforce matching student/reviewer scopes. RLS grants CRs their exact division scope and TGMs their assigned students. Private child tables deny direct client access. API registration decisions use the caller's verified token and a superadmin-only database function. Submission transitions, ownership and points are checked in the database.

## Student profile editing

Students can update their contact number and Drive folder through a restricted function. Existing academic fields require a request and superadmin approval. Approval locks the affected records, changes partition placement, clears old reviewer links and compatibility IDs, and immediately changes RLS access. The dashboard refetches valid reviewer options. Roles, approval fields, points and reviewer IDs are not editable profile fields. A separate onboarding function only fills missing student fields and rejects changes to nonempty verified values.

## Faculty and future batches

Teachers can save designation, faculty ID and a private photo. Photos use a 2 MB JPEG/PNG/WebP bucket with owner upload/read and superadmin review access. Approval and rejection are atomic across registration records.

Use Super Admin → Academic scope administration to provision a batch, department, course and division. Provision A and B separately where applicable, then assign approved CR/TGM reviewers to each scope and TG group. `provision_academic_scope` resolves metadata and creates the physical partition centrally; no frontend table-name conditionals are required. Existing legacy and future cohorts are preserved. Do not delete historical partitions.

## Loading and integration

Auth restoration shows a branded loading/error state and performs one session restoration and profile lookup. It does not depend on Render. Realtime refreshes coalesce overlapping events and surface errors. Drive traversal supports pagination and bounded concurrency with a deadline. All 16 homepage categories use the existing theme and filename guidance.

Measured production baseline: Render requests approximately 0.912, 0.940 and 0.261 seconds; frontend approximately 0.176 seconds. These samples do not prove a Render cold start or measure a signed-in user's complete session restoration. Cron is not treated as proof that cold starts are eliminated.

## Verification

`npm run lint` and `npm run build` passed. `node scripts/test-database.mjs` passed in isolated PostgreSQL (PGlite), without loading production credentials. Tests cover physical A/B placement, preserved profile counts, student protected-field rejection, direct partition denial, CR/TGM isolation, cross-division assignment rejection, CAT-16, server-calculated points, approved-submission immutability, atomic academic transfer, old reviewer access removal, private photo ownership and future-scope provisioning.

Live RLS tests also passed using database role contexts for existing approved student, CR and TGM profiles that have matching Auth identities. Expected student IDs were compared to actual visible IDs; out-of-scope submission visibility and reviewer options were checked. The test rolled back and wrote no academic data. Local server health returned 200 and unauthenticated approval/rejection endpoints returned 401.

Production health returned 200. Approval, rejection, bootstrap, Drive and Gemini endpoints returned 401 without authentication. The first deployment had unresolved Node module imports; these were fixed by bundling the shared API and using explicit extensions, then the recovery was verified. The live homepage includes all 16 categories; its dark cards, typography and blue/red accent were visually checked.

The frontend now uses same-origin API routes on Vercel by default. Render has not been redeployed, and its scheduled requests are unchanged. Vercel runs the updated shared Express API with a 60-second limit; Drive traversal has a 30-second deadline. Registration decisions call the protected Supabase RPC directly. See [Vercel Express deployment guidance](https://vercel.com/kb/guide/ship-a-express-app-on-vercel). Production environment values were reused, not printed or committed.

Remaining verification: six legacy faculty profiles have no corresponding Auth account even by email; no accounts were invented, passwords reset, or invitation emails sent. Browser tests for every real role and actual photo/Drive uploads still require those account sessions. End-to-end signed-in auth timing remains unmeasured. The build still reports a large client bundle. Database role tests are not a claim of browser-session verification.

Suggested automations (not enabled): alert on sustained backend failures; review aging academic-change/registration requests; detect incompatible or inactive reviewer links; verify backup restoration periodically; report pending certificate reviews; validate Drive filename categories. Notifications require an explicitly configured recipient and authorization.

## Direct profile editing update — 2026-09-09

The latest user instruction supersedes the earlier approval-only profile UI. The old panel and academic-correction queue are removed from the dashboards. Existing request history is retained.

Students open Edit Profile beside Roll No in the header. Name, ERP, roll number, phone, department, course and division are saved through `edit_student_profile`. Department/course/division must resolve to an enabled scope within the current batch. Only configured institutional options are offered. ERP duplicates and malformed values are rejected. Email, account ID, role, points, approvals, batch and reviewer IDs cannot be changed through this editor.

Migration 005 retains column-level restrictions on direct profile writes. The narrow authenticated RPC locks the caller's profile, validates input, logs before/after values privately and updates the existing row. Existing synchronization moves physical student storage and clears incompatible reviewer links atomically when scope changes. The frontend uses the returned database record and refreshes its data and reviewer filters. No student/submission rows are deleted.

Verification: TypeScript passed; isolated PostgreSQL tests passed direct name/ERP/roll edits, protected-field rejection, invalid-batch rejection, partition transfer, new CR/TGM options and former-division isolation.

## Academic batch editing — 2026-09-10

Migration 006 extends Edit Profile with Academic year / batch. Students select a configured, enabled batch; department, course and division options are restricted to that batch. The existing protected `edit_student_profile` RPC derives all academic fields from the selected scope, saves them atomically and records before/after audit data. A batch change moves the student partition, clears incompatible reviewer relationships and refreshes the dashboard and reviewer options. Arbitrary scope IDs, role/approval edits and direct academic column updates remain prohibited. This supersedes the same-batch restriction documented for migration 005.

Type checking and isolated PostgreSQL tests pass, including a 2025–2029 to 2026–2030 transfer, correct physical placement, removal of old CR access, empty options when no reviewer is assigned to the destination, and rejection of nonexistent scopes. Migration 006 was verified in production. Existing student records were not edited for testing.

Production frontend deployment is pending: Vercel CLI reported scope-not-accessible and whoami reported Logged out on 2026-09-10. Migration 006 remains applied; the live frontend still serves the prior editor without the batch selector. Reauthentication is required before deployment can finish.

## Production release — academic year editor and super-admin cleanup
Vercel authentication restored. Deployment dpl_Egb7rwCzhU8qKYue5R5PKTTKvqU5 is READY and aliased to https://tcetaicte.vercel.app. This resolves the preceding pending-deployment note.
Students can select an enabled Academic year / batch in Edit Profile; migration 006 persists the selected scope and clears incompatible CR/TGM links. Removed ScopeAdministration and both read-only Faculty profile panels from SuperAdminDashboard as requested. Existing database records and faculty editing in the TGM dashboard are retained.
Validation: TypeScript passed, Vercel production build passed, live homepage and health returned 200, live asset includes the batch editor and excludes the scope-administration panel. Prior isolated migration tests cover batch transfer and CR isolation; no real student profile was changed for testing. No GitHub push was performed. Signed-in browser acceptance remains unverified.

Faculty dashboard cleanup: removed the Faculty profile editor from TGMDashboard at the user's request. Existing faculty records and storage are preserved. TypeScript and all isolated database test groups passed. The user has now authorized pushing the accumulated portal changes to GitHub, superseding the earlier no-push instruction.
