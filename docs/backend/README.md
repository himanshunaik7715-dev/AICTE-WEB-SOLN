# Backend documentation

Initial audit documentation; implementation-specific feature documentation will follow the corresponding verified changes.

- [Current architecture, routes and environment](../architecture.md)
- [Database inventory and schema drift](database-schema.md)
- [Student Profile Editing and CR/TGM authorization proposal](student-profile-editing.md)
- [Mandatory division storage and adding future batches](division-storage.md)
- [Audit findings](../audit/initial-audit.md)
- [Migration proposal and rollback](../audit/migration-plan.md)
- [Baseline tests and outstanding role tests](../audit/baseline-test-report.md)

Do not run the existing supabase-schema.sql against production as a migration. It contains destructive cleanup statements and has not been reconciled with the observed live schema.
