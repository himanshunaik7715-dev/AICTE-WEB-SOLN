# Mandatory division storage and access

Status: revised design, not an applied migration. This supersedes the earlier recommendation against partitioning. The requirement is institutional separation, not a 100-row PostgreSQL limit.

## Evidence and architecture

The initial production inspection found mixed role data in users, free-text academic fields, no exposed normalized student table, six profile/Auth identity mismatches and department aliases requiring reconciliation. REST metadata cannot establish the installed constraints, policies or triggers. Run the read-only `scripts/inspect-database.sql` through an authorized SQL connection before finalizing DDL.

Preferred design: an additive `students` table partitioned by LIST (`scope_id`). Each scope row has a unique canonical combination of academic batch, course, department and division. Each applicable scope gets its own named physical child table, for example `student_iot_2025_2029_div_a` and `student_iot_2025_2029_div_b`. Keep physical children in a non-API schema. A metadata registry maps scope IDs to their physical partitions for administration; clients never interpolate table names. ST is currently a cohort/group label in seed data, so canonical course identity must be resolved independently of that display label.

The public parent has no ordinary row storage; its children contain the records. PostgreSQL routes writes using scope_id and can move a row when that key changes. Existing users and submissions are preserved during the additive migration. Do not automatically drop, detach or truncate partitions, including for graduated cohorts. See [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) and [Supabase partitioning](https://supabase.com/docs/guides/database/partitions).

## Identity, keys and relationships

Keep a non-partitioned student identity registry keyed uniquely by the existing application user ID. Store its current verified scope. The partitioned student-details primary key includes `(student_id, scope_id)` because partitioned unique constraints must include the partition key. A composite FK to the identity registry's unique `(student_id, current_scope_id)` pair prevents a student's current details from appearing in multiple scopes. The transfer transaction must satisfy these constraints, using tested deferrable constraints/order of operations as necessary. This design preserves a stable target for existing submission ownership.

CR and TGM assignments contain reviewer ID, scope ID, approved/active state and structured TG group where applicable. Student reviewer relationships use composite keys including scope_id. A foreign key proves scope compatibility; a protected operation also checks reviewer role, approval and active assignment. Revoke/reassign operations must invalidate obsolete student relationships.

Submission records retain original IDs, file references, points and historical review attribution. Current reviewer access is derived from the student's current verified scope and active assignments. If submission physical partitioning is also required by the institution, add a similarly scoped submission parent only after auditing its FKs and publication setup; student partitioning alone must not be described as physical separation of every existing table. Historical academic scope remains audit data and must not grant the previous CR ongoing access.

## Enforcement at every layer

1. Database: partition bounds separate student rows; scoped FKs prevent incompatible reviewer links; protected role/academic fields cannot be changed through ordinary profile writes.
2. Supabase RLS: parent policies permit own student records, exact authorized CR scope, assigned TGM students and protected superadmin access. Enable RLS on children too and revoke direct child-table privileges from anon/authenticated. Test direct-child access explicitly; do not assume parent rules protect arbitrary direct child queries. New children start without application grants. Any views must preserve caller security.
3. Backend queries: use the authenticated actor and database-approved scope assignments; never accept an arbitrary client scope as permission. Apply the same predicate to counts, search, exports and realtime refetches.
4. API authorization: reject cross-scope reads/writes, stale assignment IDs and unapproved reviewers. Service-role handlers bypass RLS, so they must make explicit actor/scope checks or delegate to narrowly authorized RPCs. User metadata cannot grant roles.
5. Frontend: show only server-returned eligible options. Invalidate profile, options, submission queues and counts following an approved transfer. Frontend filtering is supplementary.

RLS must cover all exposed legacy tables while compatibility reads exist, otherwise the old users/submissions endpoints remain a bypass. Verify Realtime publication and replica identity for the actual PostgreSQL/Supabase configuration; partition movement may affect event delivery. Consumers refetch authoritative data instead of trusting a stale event payload.

## Central repository contract

Proposed names, not currently implemented:

| Operation | Contract |
|---|---|
| getStudentsForScope(actor, scope, cursor) | Validate actor scope then page through the parent dataset |
| getCRForScope(actor, studentId) | Derive student's verified scope; return approved matching CR assignment choices |
| getTGMForScope(actor, studentId) | Derive verified scope and group; return approved matching TGM choices |
| getSubmissionsForScope(actor, scope, cursor) | Join current student scope and required reviewer assignment; preserve pagination |
| requestAcademicChange(actor, desiredScope, reason) | Own student only; create pending request without changing active scope |
| approveAcademicChange(actor, requestId, expectedVersion) | Superadmin only; atomic transfer and relationship reconciliation |

One data-access module owns these operations, and API handlers/dashboard services use it. No frontend condition chooses table A versus table B. Physical partition names occur only in provisioning/catalog code, never ordinary reads.

## Academic change workflow

Students may request batch/course/department/division corrections but may not directly edit the authoritative classification. Store request status pending/approved/rejected, requested scope, current scope/version, requester, dates and administrator remarks. Student contact/profile edits use a separate allowlist.

Approval locks the request and student identity, checks expected version and destination provisioning, verifies administrator authority, records the decision, clears incompatible reviewer relationships, updates identity/details scope and selects a reviewer only when an explicit valid assignment decision exists. Where multiple TGMs are eligible, leave assignment pending and offer only eligible options. Preserve all submission/history rows. Commit all changes together; failure rolls back the entire transfer. Rejection preserves the current scope and assignments. Retried approvals are idempotent.

RLS reads current committed scope immediately. Already downloaded information cannot be retroactively withdrawn from a browser, but subsequent requests from the old CR/TGM must be denied and client caches must be invalidated. Nightly checks supplement this transaction; they do not provide the immediate access guarantee.

## Adding a new batch/division

1. Administrator registers the batch years and existing canonical course/department, marks whether it has divisions and explicitly lists valid divisions. Require explicit A/B scope for applicable cohorts from 2025 onward; no empty wildcard scope.
2. A migration-owner provisioning command validates metadata, locks the registry and idempotently creates one partition per scope. Generate quoted identifiers server-side from controlled values; never execute user-supplied table names. Record the physical mapping and partition bounds.
3. Create/verify inherited indexes, child RLS, denied direct grants and publication behavior. Do not grant runtime browser roles schema CREATE rights.
4. Assign approved CRs/TGMs to each scope/group. Validate no A-to-B relationships. Keep ambiguous reviewer choices pending for an administrator decision.
5. Mark the scope available for onboarding only after provisioning and access tests pass. Reject enrollment into an unprovisioned scope rather than silently routing it to a generic default partition.
6. Use the existing repository operations unchanged. Test both directions of isolation, another department/course and future-batch access; verify physical placement with tableoid joined to the partition registry using an administrative connection.

Legacy pre-2025 records need separately provisioned, explicit legacy scopes after review. Existing unknown values are preserved until reconciled; they must not be silently merged or deleted.

## No-data-loss rollout gates

Take and verify a restorable encrypted backup; export live schema; preserve existing tables/IDs; backfill into additive structures using a consistent snapshot and captured write deltas. Compare per-scope counts, IDs, file references, hours/points and review histories. Reconcile exceptions before switching reads. Keep compatibility rollback available. No destructive baseline script, automatic retention deletion or partition removal is permitted.

Acceptance tests: A student cannot request B assignments; CR A cannot select/update/export B records; CR B cannot access A; TGM sees only assigned students; forged scope filters and direct child endpoints fail; safe profile edits work; transfer clears stale links atomically; concurrent transfer/save is rejected or retried safely; counts/history are preserved; next academic year needs only metadata/provisioning.
