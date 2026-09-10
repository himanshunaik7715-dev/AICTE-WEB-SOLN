# Proposed architecture and safe migration plan

Status: proposal before any schema redesign. No migration SQL has been executed. The live schema is materially different from the checked-in baseline.

## Decision

Retain the working application IDs and existing tables during an additive transition. Introduce central identity linkage and role-specific ownership without immediately renaming or dropping `users`, `admins` or `submissions`. The user's mandatory institutional requirement supersedes the original recommendation against partitioning: use separately identifiable physical student partitions for applicable 2025-onward academic scopes, behind one parent dataset. This is for institutional separation, not performance at current volume or an imagined 100-row limit. See [division storage and provisioning](../backend/division-storage.md). Final executable migration depends on inspecting the live PostgreSQL catalogs and version.

Proposed entities: identity/profile linkage to Auth, student details, teacher details, protected role memberships, canonical departments/courses, academic batches, academic scopes, CR scope assignments, TGM scope/group assignments, student reviewer relationships and an audited academic-change record. Separate a faculty invitation/whitelist from an actual authenticated identity so unclaimed invitations do not require fabricated Auth IDs.

## Ordered rollout

1. Obtain the live schema/catalog export and verify the deployment target. Inventory policies, functions, triggers, grants, Storage, publication membership and every table dependency.
2. Take an encrypted database backup including schema/data and document restoration. Protect Auth and Storage backups. Record deployment versions and a reversible deployment path. A count snapshot is not a backup.
3. Reconcile six profiles without matching Auth IDs. Produce a reviewed mapping of existing application ID to Auth UUID. Preserve submission/reviewer IDs; prefer adding auth_user_id rather than rewriting primary keys. Never infer identity from a display name.
4. Build a reviewed catalog/alias mapping for `Internet of Things (IoT)`, `IOT`, `CSE- (IOT)` and supported course codes. Unknown/malformed values and the future cohort remain exceptions for verification. Do not silently merge records.
5. Add normalized tables/columns and indexes. Backfill from existing records in bounded, repeatable operations. Retain legacy columns and compatibility reads until parity is proved. Protect new tables with deny-by-default RLS before exposing them.
6. Parse group lists into scoped assignment rows, review duplicates/ambiguous faculty invitations, and map CR/TGM relationships. Validate exact department/course/batch/division correspondence. Quarantine exceptions for administrator review; do not choose a mentor arbitrarily.
7. Implement field-allowlisted profile editing, explicit reviewer lookup/assignment RPCs, transactional academic changes and stale-assignment reconciliation. Add relational constraints and strict role-specific RLS. Audit all existing policies because permissive policies combine with OR.
8. Replace unsafe bootstrap authorization and make approval decisions transactional. Share backend handlers across deployment entry points and ensure Render actually serves the frontend's routes.
9. Add private teacher-photo storage and teacher detail metadata. Enforce MIME/type, size, ownership, path and read policies. Upload binary objects; store paths, not Base64. Preserve the previous photo if replacement fails and clean only confirmed unreferenced objects.
10. Deploy frontend auth gate, safe profile form, verified academic display, dynamic options, teacher request/photo UI and shared institutional branding. No GitHub changes are requested; deployment must use an authenticated direct deployment channel.
11. Validate counts, distinct identity mappings, FK checks, duplicate scopes, role invariants, no cross-division access, pending requests and all dashboards. Re-run profile/assignment tests from the dedicated document. Keep a reconciliation log.
12. Only after parity and regression testing, switch reads to normalized ownership. Removal of legacy columns/tables is a separate future migration with its own dependency/backup review.

## Validation and rollback

Compare before/after row counts and IDs for all current tables; submissions should remain intact. Validate every migrated student/reviewer relationship, Auth mapping, pending status, file reference and history. Production users may write during migration, so use a transaction/snapshot or maintenance window and capture deltas rather than assuming static counts.

Rollback application deployment first if compatibility allows. Keep additive schema and original columns until a tested rollback window closes. Data reconciliation must be audit-trailed and reversible. Do not restore a stale backup over intervening legitimate student submissions. Never disable RLS as a repair shortcut.

## Implementation boundaries

Safe student-editable fields and exact scoped assignments are specified in [Student Profile Editing](../backend/student-profile-editing.md). Teacher branch selection must come from the same catalog. Teacher photos need a new bucket because production currently has none. A service-role API key alone does not provide arbitrary PostgreSQL DDL or Vercel/Render deployment access.
