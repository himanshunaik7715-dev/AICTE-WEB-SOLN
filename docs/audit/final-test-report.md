# Production change report — 2026-09-09

Status: database, frontend and API deployed; authenticated browser acceptance is not fully verified. See `../deployment-status.md` for architecture, remaining checks and automation suggestions.

| Check | Result |
|---|---|
| Supabase migrations 001–004 | Applied and version records verified |
| Original users/admins/submissions | All rows exactly match protected pre-migration snapshots: 72 / 9 / 74 |
| Physical 2025–2029 division storage | A: 25 students, B: 31 students; separate PostgreSQL child tables |
| Future-batch preservation | 2030–2034 A: 1 student retained separately |
| Live RLS role contexts | Approved Auth-linked students, CRs and TGMs passed expected-ID and submission-scope comparisons |
| Student profile editing | Isolated tests passed safe contact changes and protected field rejection |
| Academic changes and dynamic reviewers | Isolated tests passed approval-only transfer, stale link clearing, new-scope options and old-reviewer access removal |
| Direct child table access | Denied to student database role in isolated tests |
| Submission authorization | Isolated tests passed cross-division denial, CR/TGM stages, CAT-16 and approved record immutability |
| Faculty photo storage | Isolated ownership and admin-read policies passed; actual browser upload pending |
| Future scope provisioning | Isolated repeat provisioning and unauthorized access rejection passed |
| Type checking / builds | Passed locally and on Vercel |
| Production API | Health 200; all tested protected routes return 401 without a token |
| Production homepage | All 16 categories and naming guide visible; dark theme visually verified |
| GitHub | No push or remote repository changes |

Latest deployment: `dpl_6ZmSq2ny3Ee3N6GSMkkfsVm7Sw5e`, aliased to https://tcetaicte.vercel.app. The updated API is hosted alongside the frontend; the original Render service remains unchanged.

These tests do not prove every production user flow. No role passwords were available in the supplied attachment; six legacy faculty profiles do not have matching Auth accounts. No production academic data was edited for testing. Same-database snapshots protect this migration but are not a substitute for independent backups. No recurring automation or outgoing notification was enabled.

Profile editor follow-up: migration 005 is verified live; production counts remain 72 users, 57 partitioned students and 74 submissions. Direct editing replaces the old correction request panel; the earlier approval-only test entries above are historical. New isolated tests verify direct saves, protected fields, same-batch scope validation, physical transfer and updated reviewer filtering. No production student details were changed for tests.

2026-09-10: Academic batch editing added. Migration 006 verified in production. Type checking and database tests passed cross-batch transfer, partition movement, previous CR isolation and invalid destination rejection. Batch options now constrain department/course/division options; all changes use the protected save RPC.

## Production release — academic year editor and super-admin cleanup
Vercel authentication restored. Deployment dpl_Egb7rwCzhU8qKYue5R5PKTTKvqU5 is READY and aliased to https://tcetaicte.vercel.app. This resolves the preceding pending-deployment note.
Students can select an enabled Academic year / batch in Edit Profile; migration 006 persists the selected scope and clears incompatible CR/TGM links. Removed ScopeAdministration and both read-only Faculty profile panels from SuperAdminDashboard as requested. Existing database records and faculty editing in the TGM dashboard are retained.
Validation: TypeScript passed, Vercel production build passed, live homepage and health returned 200, live asset includes the batch editor and excludes the scope-administration panel. Prior isolated migration tests cover batch transfer and CR isolation; no real student profile was changed for testing. No GitHub push was performed. Signed-in browser acceptance remains unverified.
