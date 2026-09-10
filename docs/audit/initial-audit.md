# Initial technical audit — 8 September 2026

## Scope and evidence

This is the initial audit and migration proposal, not a completion report for the requested implementation. Source inspection, a baseline build/type check, read-only production REST/Auth/Storage inspection and public HTTP measurements were performed. No production data, credentials, schema, deployment or GitHub repository was changed. Dependencies were installed locally with lifecycle scripts disabled. No seed or repair script was executed.

Production: frontend `https://tcetaicte.vercel.app/`, Express backend `https://aicte-web-soln.onrender.com`, Supabase for identity and application data. The provided environment connects to the inspected Supabase project. Hosting configuration and the cron schedule are not available in the repository.

The repository SQL is **not a reliable representation of the live database**. Live API metadata was inspected, but PostgreSQL catalogs, actual policy expressions, triggers, indexes, grants and constraints need a database connection or SQL-editor export. A service-role read bypasses RLS and cannot establish role isolation.

## Architecture

See [architecture](../architecture.md), [database inventory](../backend/database-schema.md), [profile and authorization proposal](../backend/student-profile-editing.md), [migration plan](migration-plan.md) and [baseline test report](baseline-test-report.md).

The application uses React 19, TypeScript, Vite, Tailwind 4, Express and Supabase JS. `src/App.tsx` owns role routing, authentication restoration, subscriptions, dashboard state, submission processing and approvals. `src/components/` mixes pages, dialogs and reusable elements. Three application tables carry almost all state: `users`, `admins`, `submissions`. Browser clients perform most CRUD directly through Supabase. Express handles Drive, Gemini, bootstrap and dashboard counts. Four separate Vercel API files partially duplicate server behavior.

## Findings, ordered by severity

| Priority | Finding and source | Consequence / required correction |
|---|---|---|
| Critical | `api/auth/bootstrap-profile.ts` and `server.ts` trust `authUser.user_metadata.seededRole` when deriving superadmin role | User-editable metadata must never establish privileges. For an already whitelisted identity this is an escalation path in the implementation. Derive privileges exclusively from an identity-matched, administrator-controlled role record. Not exploit-tested in production. |
| Critical | `supabase-schema.sql` includes unconditional `DROP TABLE ... CASCADE` for students, faculty, CR assignments and other tables, plus column drops | Do not use this script as a production migration. Existing `CREATE TABLE IF NOT EXISTS` statements also do not retrofit constraints onto existing tables. |
| High | `users_update` permits self-updates; `protect_user_privileges()` protects role/approval but not academic scope or CR/TGM fields | A crafted student request can modify reviewer-routing inputs under the checked-in policy. Use field-allowlisted writes and database protection, with verified academic-change processing. |
| High | `submissions_select` and `submissions_update` allow every approved `admin` | TGM client filtering does not protect the database. Require an active TGM assignment for the particular student and matching academic scope. Live policy behavior still needs authenticated tests. |
| High | `users_select` allows admins to read every profile; approved privileged profiles are visible to all authenticated users | Scope staff access and expose a minimal reviewer directory rather than full private profiles. |
| High | `current_cr_scope()` omits department/course and permits empty or `All Divisions` wildcards | Cannot guarantee academic isolation, particularly for batches starting in 2025 or later. Model explicit scope assignments. |
| High | Submission trigger protects selected flags/status fields but not student changes to approved hours/points/content; reviewer transitions only check the new status | Enforce previous-to-next transitions, immutable ownership, reviewer identity and point calculation in the database. Approved submissions must not remain editable through ordinary student writes. |
| High | Frontend approval/rejection calls target Render, but handlers only exist under `api/superadmin/` | Production unauthenticated POST probes returned 404 for both routes. Register the shared handlers on Render and keep all consumers consistent. |
| High | Six live profiles have IDs absent from the Auth-user ID set | A normalized Auth FK cannot be added blindly. Reconcile by verified identity, preserve existing application IDs and dependent relationships. |
| High | Local environment contains `VITE_GOOGLE_CLIENT_SECRET` | Sensitive credentials should never use a frontend-exposed prefix. No source reference was found; this is a configuration hazard, not proof of deployed leakage. Check deployed bundles/history before determining rotation requirements. |
| Medium | `sessionRestoring` is initialized and cleared but never consulted by JSX in `App.tsx` | Confirmed source cause of the public-page flash: initial `currentRole='auth'` renders the landing page while restoration runs. |
| Medium | `getUser()` then profile lookup, with a second identical student profile lookup | Adds sequential network latency. Resolve the session and one identity-matched profile; keep dashboard data outside the auth gate. |
| Medium | `getUserProfileByEmail()` swallows DB errors and can return cached data | Network failure can become an apparent missing profile or stale authorization result. Distinguish no session, missing profile, forbidden, and network error. |
| Medium | No central auth-state-change subscription or cancellation of initial restoration | Cross-tab sign-out and overlapping login/restore work can leave stale UI. StrictMode repeats initialization effects in development. |
| Medium | `StudentDashboard.tsx` checks division only for the literal `2025-2029`, never department/course; CR options do not check approval | Future batches and cross-department options are incorrectly scoped. ST/TT/BT are year/group labels in seed data, not department identities. |
| Medium | `completeStudentProfile()` retains CR/TGM IDs while changing academic information | Existing assignments can become stale. Reconcile within the same transaction as an approved academic change. |
| Medium | Teacher requests have duplicated department choices, fabricated ERP/roll defaults and fixed batch `2023-2027` | Remove artificial student fields from faculty ownership; centralize the supported academic catalog. |
| Medium | Live `users` metadata has no `photoUrl`; Storage bucket list is empty | Teacher photograph storage does not exist. Add a private bucket, restricted policies, validated upload and stored path metadata. |
| Medium | Approvals separately update `users` and `admins`; backend and UI approval checks differ | Partial writes can leave approval drift. One live superadmin profile is pending. Use transactional decisions and one approval authority. |
| Medium | Subscriptions refetch full tables; superadmin also polls every 15 seconds and has another users subscription | Duplicate traffic, no pagination, races and growing costs. Coalesce refreshes and load only role-scoped data. |
| Medium | Initial empty query results are ignored when `data.length === 0`; requests can finish after unsubscribe | Stale caches can survive empty results or late responses. Clear caches on identity changes and suppress obsolete responses. |
| Medium | Profile/admin writes update cache before DB success and frequently suppress errors | UI can report success for rejected persistence. Publish saved server results only after success. |
| Medium | Drive traversal is recursive and sequential, with no `nextPageToken` handling or fetch deadline | Large trees are slow or incomplete. Bound concurrency, validate IDs, paginate and apply deadlines. |
| Medium | Drive/Gemini endpoints verify institutional identity but do not require approved application access or impose per-user quotas | Unapproved authenticated users can consume backend/external-service resources. Add explicit permissions and rate limits. |
| Medium | AI classification accepts category 16, but `App.tsx` remaps values above 15 to category 6; AI flow invents 24 hours | Incorrect classifications/points. Preserve unsupported results for review and never infer earned hours as a fixed default. |
| Medium | Production build eagerly includes all role dashboards and export libraries | Initial JS is 969.20 KB / 272.13 KB gzip. Lazy-load role pages and PDF/XLSX utilities. |
| Low | `AdminPortal.tsx` is imported but never rendered; simulated Drive upload helpers have no callers | Candidates for removal only after reference and regression checks. Never describe the simulated uploader as real storage. |
| Low | Giant components, repeated whitelist logic, duplicated status formatting and department options | Split by responsibility gradually; preserve existing functional entry points. |
| Low | CSS clips horizontal overflow globally; broad table/modal selectors affect unrelated elements | Visual hiding can conceal layout defects. Use scoped layout/table primitives and test each requested width. |
| Low | Alert dialogs, immediate modal closure, missing loading/error branches, delayed sign-in callbacks | Replace with accessible inline feedback and awaited submit states. |

## Live data summary

Observed at audit time; not a backup and not a promise that these counts remain constant during production use:

- 72 profiles: 57 students, 6 CRs, 8 TGMs (`admin`), 1 superadmin.
- 9 whitelist/request rows; 74 submissions; 82 Auth users in the returned first page (page size 1,000).
- Six profile IDs did not match an Auth-user ID. No submission had a `studentId` missing from the profile set.
- One CR link and one TGM link differed by department text: `CSE- (IOT)` versus `Internet of Things (IoT)`. Their batch and division matched. No cross-division link was found in this snapshot.
- Other student department values include `IOT`; a `2030-2034` student batch exists. Do not silently rewrite either without institutional verification.
- No Supabase Storage buckets were returned.
- Live status counts: imported 58, pending CR 12, pending TGM 3, resubmission requested 1. No approved submission was present in this snapshot.

## Measured loading and remaining uncertainty

The first successful public Render health request took 911.7 ms total, Vercel HTML 176.0 ms. Later sequential Render health requests took 940 ms and 261 ms with a different client/connection context. These samples demonstrate reachability and warm response time only: DNS/TLS/network conditions differ, and no deliberately cold instance was measured. Cron configuration and idle behavior remain unverified.

Production profile-table count query: 1,244 ms; admins: 820 ms; submissions: 198 ms. These were sequential service-role count queries, **not** session restoration or a student's profile latency. They must not be used as those metrics.

Normal session restoration in the inspected code calls Supabase directly; it does not call Render. Render can affect first-login bootstrap, Drive/AI work and superadmin counts, but is not a dependency of the normal restore path. The UI-gating defect is established; the reported minute-long delay has not been reproduced with a valid role session.

Required instrumentation: AUTH START, SESSION RESOLVED, PROFILE RESOLVED, ROLE RESOLVED, DASHBOARD DATA START/COMPLETE. Use per-attempt IDs and monotonic timings without recording tokens, emails or profile contents. Record request counts, duplicates, response failures, median/p95 and cold-versus-warm observations. Do not count browser automation tool latency as application latency.

## Audit limits and next execution requirements

The attached brief contains password placeholders, not a usable credential table. The user confirmed that supplied credentials are production credentials and requested no GitHub changes; no passwords were changed or guessed. The browser session opened the unauthenticated production landing page. Authenticated refresh/reopen tests, destructive-permission probes and real approval/submission changes have not been performed.

For production implementation without GitHub updates, direct Vercel/Render deployment access and a PostgreSQL migration connection or authenticated Supabase SQL editor are needed. The supplied service-role REST key permits data inspection but is not a database password or a deployment token. No such deployment/SQL credentials were found among the supplied environment variable names. Prepare and validate migrations before applying them; do not turn live student records into disposable test fixtures.
