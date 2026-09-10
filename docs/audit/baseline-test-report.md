# Baseline test report — 8 September 2026

These are pre-change audit results, not final implementation acceptance results.

| Check | Result | Evidence/limit |
|---|---|---|
| Local production build | PASS with size warning | Vite: JS 969.20 KB, gzip 272.13 KB; CSS 82.23 KB, gzip 12.77 KB. Express bundle 25.0 KB |
| TypeScript check | FAIL | Header.tsx:293 compares a value narrowed to student with cr/admin (TS2367 twice) |
| Configured secrets in fresh client build | PASS for exact values checked | Service-role, Google client secret, Drive, Gemini and Resend secret values were absent from generated client JS. This does not verify hosted bundles or Git history |
| Production Vercel HTTP | PASS | 200, total 176.0 ms, first byte 175.9 ms |
| Production Render health | PASS for observed requests | Initial 200, 911.7 ms; later fetch measurements 940 ms and 261 ms |
| Render approval route | FAIL | Unauthenticated POST /api/superadmin/approve-request returned 404, consistent with missing Express handler |
| Render rejection route | FAIL | Unauthenticated POST /api/superadmin/reject-request returned 404 |
| Anonymous users/admins/submissions reads | PASS for these requests | Each returned 401 using the configured anonymous key; no records returned |
| Live schema comparison | FAIL parity | Missing users.photoUrl, extra submissions.fileDataUrl, type/required-field differences |
| Live identity mapping | FAIL readiness for Auth FK | 6 of 72 profile IDs absent from 82 Auth IDs returned |
| Submission references | PASS data snapshot | 0 orphan studentId references among 74 submissions; FK installation not proved |
| Current assignment equality | FAIL canonical department equality | 1 CR and 1 TGM relationship differ in department spelling; batch and division match |
| Teacher photo storage | NOT IMPLEMENTED | No Storage buckets returned; live users metadata has no photoUrl |
| Authenticated homepage flash | SOURCE DEFECT CONFIRMED; runtime untested | Restoration flag is not used in rendering. No usable passwords or role sessions supplied |
| Render cold start | NOT ESTABLISHED | No cold-instance trace or cron configuration; warm samples do not rule out cold starts |
| Auth/session/profile/role latency | NOT MEASURED | Service-role count timings are not user auth timings |
| Dashboard request count and realtime latency | NOT MEASURED for authenticated sessions | Code shows parallel subscriptions plus duplicated superadmin refresh paths |
| Student profile editing / dynamic CR-TGM options | NOT IMPLEMENTED / unsafe current contract | See proposed profile contract and tests |
| Responsive acceptance at 1920/1440/1366/1024/768/mobile | NOT RUN | Public page opened; no complete viewport/role matrix captured |
| GitHub changes / credential resets / production writes | NONE | No commit/push, seed/repair execution, migration or deployment |

Initial sandbox-blocked HTTP attempts were excluded from timing claims. Count queries (service role, sequential): users 1244 ms, admins 820 ms, submissions 198 ms. No secrets or private record contents are included here.

## Role matrix still required

| Role | Login/refresh/reopen | Access isolation | Workflow | Profile/assignment |
|---|---|---|---|---|
| Student | Not run | Own versus other students not run | Submission/Drive/points/export not run | Safe update, protected-field denial, option refetch and stale relationship handling not run |
| ST CR A | Not run | A allowed, B denied not run | Review/resubmission not run | Exact 2025 batch/course/department scope not run |
| ST CR B | Not run | B allowed, A denied not run | Review/resubmission not run | Exact 2025 batch/course/department scope not run |
| TT CR 1 / 2 | Not run | Legacy explicit cohort scope not run | Review/resubmission not run | No implicit wildcard access not run |
| BT CR 1 / 2 | Not run | Legacy explicit cohort scope not run | Review/resubmission not run | No implicit wildcard access not run |
| TGM | Not run | Assigned students only not run | Approval/rejection/resubmission not run | Scope changes and revoked assignments not run |
| Superadmin | Not run | Protected authority not run | Approval endpoints currently 404 on Render | Teacher branch/photo and academic changes not run |

Do not substitute service-role queries for role tests: they bypass RLS. Do not reset production credentials to obtain a test login. The exact requested login → refresh → close tab → reopen test must be repeated for several valid role sessions, including slow/error conditions, before claiming the homepage flash fixed.
