# Database inventory — initial audit

This document distinguishes live REST metadata from `supabase-schema.sql`. Production count snapshot: users 72, admins 9, submissions 74. No migration was performed. No full catalog export was available, so live RLS expressions, indexes, checks, unique constraints and FK enforcement are **unverified**.

## users

Purpose: mixed central application identity, role, academic profile and reviewer routing. Used by authentication, all dashboards, assignment selection and approval processing.

Live columns:

- Text primary key: `id`.
- Identity: `name`, `email`, `role`.
- Student: `studentUid`, `phoneNumber`, `course`, `rollNo`, `erpNo`, `department`, `division`, `academicBatch`.
- Relationships: `tgmId`, `tgmName`, `crId`, `crName`, `tgGroup`.
- Integration: `driveRootFolderId`.
- Authorization: `tgmApprovalStatus` (default pending), `approvedBy`, `approvedAt`, `customRole`.
- Timestamps: `created_at`, `updated_at` (timestamptz, default now).

The TypeScript `photoUrl` field and SQL baseline `photoUrl` column are absent from live REST metadata. Faculty group lists are encoded in `customRole`. Dates such as approvedAt are text, unlike created_at.

Baseline-only declared constraints: email unique/non-null, role and approval checks, lower-email index, primary key; no Auth FK or CR/TGM FKs. Live OpenAPI identifies only `id` as required, unlike the baseline's broader NOT NULL declarations. Six application profile IDs have no matching Auth ID. Adding an Auth FK immediately would therefore fail or break existing ownership.

Baseline RLS: self-read/write, superadmin management, admins read all profiles, approved staff broadly readable, CR student reads use division/batch wildcards without department. Trigger prevents role/approval changes for ordinary self-updates but leaves academic and assignment fields writable. See [student profile authorization](student-profile-editing.md).

## admins

Purpose: faculty whitelist and privileged-account decision queue. Used by registration, bootstrap, superadmin dashboard, approvals and counts.

Live columns: text PK `id`; text `email`, `name`, `designation`, `department`, `addedBy`, `addedAt`, `approvalStatus` (default pending); boolean `isWhitelisted` (default false). No live photo field. The baseline declares unique email and approval checks, but live constraint presence is unverified. No declared FK connects this table to users/Auth in the baseline.

Baseline RLS: own request readable; approved whitelisted entries readable; superadmin management; own pending, non-whitelisted insert. Updates to this table and `users` are separate requests, so partial failures can cause divergence.

## submissions

Purpose: activity metadata, points, certificate reference/history and two-stage review. Used by student, CR and TGM dashboards, dialogs and exports.

Live columns:

- Text PK `id`; text `studentId`.
- Student snapshot: `studentName`, `studentRollNo`, `studentErpNo`, `studentDepartment`, `studentDivision`.
- Activity: text `semester`, `activityName`, `conductedBy`, `shortDescription`; integer `activityCategoryNo`; numeric `hoursSpent`, `calculatedPoints`.
- Files: text `currentFileDriveId`, `fileName`, `fileDataUrl`; JSONB `fileDriveIdHistory`.
- CR review: boolean `isCheckedByCR` (default false); text `crCheckedAt`, `crCheckedBy`, `crRemarks`.
- TGM review: boolean `isVerifiedByTGM` (default false); text `tgmVerifiedAt`, `tgmVerifiedBy`, `tgmRemarks`.
- State: text `status`, `resubmissionRequestedBy`, `createdAt`, `updatedAt`.

Baseline differences: integer hours/points instead of live numeric; baseline includes `rejectionReason`, which live metadata does not expose; live metadata includes `fileDataUrl`, which baseline CREATE omits. Client persistence deliberately strips fileDataUrl.

Baseline declares FK studentId to users(id) ON DELETE CASCADE, category range 1–16, nonnegative hours/points, state checks and student/status indexes. Live OpenAPI does not identify that FK. A data check found zero orphan student references; this does not prove a constraint exists.

Baseline RLS: student owns its rows; CR reads/updates through student.crId; all approved TGMs read/update all submissions; superadmin reads/updates/deletes; student inserts/deletes own rows. Row visibility alone does not prevent tampering with individual fields. Trigger transition and immutable-field protections need strengthening.

## Enums in application/baseline

Roles: `student`, `cr`, `admin`, `superadmin`. Approval: `pending`, `approved`, `rejected`. Submission: `imported`, `naming_error`, `skipped_not_pdf`, `pending_cr`, `pending_admin`, `approved`, `rejected`, `resubmission_requested`. Resubmission actor: `cr`, `tgm`, null. Semester TypeScript union: `SEM_1` through `SEM_8`. These are mostly text values/checks, not verified PostgreSQL ENUM types.

## Relationships

```text
auth.users -- intended identity mapping --> public.users
public.users (student) -- crId --> public.users (CR)
public.users (student) -- tgmId --> public.users (TGM/admin)
public.users -- studentId --> public.submissions (many)
public.admins -- email/id convention --> public.users
```

Only submissions-to-users is declared as an FK in the checked-in baseline. Academic batch/department/division are free text, not relational entities. No production Storage buckets were returned. This is not a complete inventory of schemas hidden from PostgREST.

## Required catalog inspection before migration

Export pg_tables, pg_attribute/format_type, pg_constraint, pg_indexes, pg_policies, pg_trigger, function definitions, grants and Realtime publication membership. Include auth identity mapping and Storage policies/buckets. Inspect all public/security-definer functions and non-public dependency schemas. Capture a backup with restore verification before any DDL. Follow the [migration plan](../audit/migration-plan.md).
