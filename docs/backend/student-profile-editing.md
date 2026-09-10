# Student profile editing and CR/TGM authorization

Status: proposed implementation contract; not deployed. Current dashboard only edits Drive folder and directly writes CR/TGM relationships. Initial onboarding can write academic fields. A safe My Profile editor is still required.

## Ownership and allowed edits

| Field | Proposed owner | Reason |
|---|---|---|
| Phone number | Student, with existing format validation | Existing project requires this contact field; it does not establish reviewer scope |
| Display name | Student only if distinct from verified institutional name | Do not let an informal edit silently alter official identity on academic exports |
| Drive root reference | Student, validated ID/allowed Google URL | Existing workflow; not an authorization source |
| Verified full name, UID, ERP and roll number | Verified institutional/admin change | Identity and report integrity |
| Academic batch, department/branch, course, division | Verified institutional/admin change | Changes alter CR/TGM access to private records |
| Role, approval status, points, permissions, internal auth fields | System/admin only | Privilege and academic integrity |
| CR ID, TGM ID, TG group | Server-managed assignment operation | Never accepted by general profile-update payload |

No new phone requirement for teachers is proposed. Academic changes need verification; until a change-request workflow exists, show the classification read-only with a clear instruction to contact administration. Do not let a pending request modify active access. Institution-approved names and exact branch catalog need confirmation from actual academic records, not internet guesses.

## Student entry point and processing

Student Dashboard → My Profile / Edit Profile. Fetch the current profile, show safe editable fields and verified academic fields separately, validate, disable Save during processing and report inline success/error. Backend/Supabase RPC accepts an explicit allowlist and derives identity from the validated token, never from a submitted student ID. Unknown/protected fields produce an error. Refetch persisted profile and permitted reviewer options after success. RLS and database triggers also reject direct protected-column updates.

## Relational scope

Use a canonical academic scope containing batch, department, course and division. Seed data uses ST/TT/BT as cohort/group labels; do not confuse ST with a branch code. For 2025-onward cohorts, division must be explicit. Historical blank divisions require an explicit legacy scope; they must never mean access to every future division.

Reviewer assignments link an approved CR or teacher identity to one or more explicit academic scopes. Student reviewer links reference those assignments, with a composite relationship that proves the student's scope matches the assignment's scope. Group membership is structured data rather than comma-separated `customRole` text.

Reviewer-option query: derive the student's verified scope server-side, return only active approved matching assignments and minimal display fields. No client-supplied batch/division override. A separate assign RPC may accept a candidate assignment ID, lock the student row, verify scope and reviewer approval, then update the relationship. A forged Division B assignment ID from Division A must fail even if it was once valid or the UI is bypassed.

## Academic changes and stale relationships

Within one transaction: lock profile/student, authorize the administrator, validate the new academic scope, update classification, retain only relationships still valid for that scope, record old/new values and reason, and clear or replace invalid links according to an explicit institutional assignment decision. Multiple eligible TGMs must not be resolved by arbitrarily choosing the first record. Preserve submission history and review provenance. Realtime then invalidates profile/options/dashboard caches. Apply the same reconciliation when a reviewer assignment changes or is revoked.

## RLS and backend rules

Student reads only own private records. CR reads/reviews only students in an active exact CR scope (and the designated relationship where required by the institution). TGM reads/reviews only assigned students with matching scope. Superadmin is determined from protected database state, never user metadata. A safe reviewer directory exposes no unnecessary phone/ERP/private fields. Security-definer functions require fixed search_path, explicit actor checks and restricted EXECUTE grants.

## Required tests

Test safe update and refetch; direct protected-field update rejection; missing/unknown fields; expired sessions; another student's ID; department/course/batch/division mismatches; Division A requesting Division B IDs; 2026-onward batches; historical legacy scope; pending/rejected reviewers; revoked assignments; concurrent academic change versus assignment save; stale cached options; ambiguous assignments; realtime invalidation. Repeat both via UI and authenticated raw API/RPC calls. Production testing must avoid changing real approved points or reviews merely to create fixtures.
