# Proposed portal automations

These are suggestions; no scheduled tasks or notifications have been enabled.

| Automation | Trigger | Action and limits |
|---|---|---|
| Certificate filename check | Import or submission | Validate SEM-01–08, CAT-01–16 and PDF suffix, show actionable feedback before CR submission. Do not rename or delete Drive files automatically. |
| Academic transfer reconciliation | Administrator approves academic change | Transactionally invalidate incompatible CR/TGM links, apply verified scope and refresh eligible choices. This must be synchronous, not a nightly-only repair. |
| Pending-review digest | Proposed daily working-day digest | Notify CR/TGM about aging assigned items only; use institution-configured thresholds. No automatic approval/rejection or awarding points. |
| Student deadline reminders | Institution-configured submission deadlines | Remind eligible students with incomplete submissions. Scope recipients correctly; deduplicate by student/deadline/template. |
| Assignment integrity monitor | Proposed nightly read-only check | Report missing, revoked or cross-scope CR/TGM relationships to administrators. Alert on changes; do not guess replacement mentors or alter academic classifications. |
| Backend performance monitor | Proposed periodic health and safe synthetic probes | Record status, response time and failures; alert on sustained regression. Separate Render health from Supabase auth/profile latency; do not claim pings prevent all cold starts. |
| Backup verification | After provider backup and periodic restore drill | Check backup completion and test restorability in an isolated authorized environment. Never overwrite production or delete historical partitions automatically. |
| Semester summary | Approved semester close | Generate scoped pending/approved totals and export-ready reports; retain source records and record report cutoff time. |

Implement notifications through a durable outbox with retries, deduplication keys and delivery state. Recheck recipient scope at send time, avoid attaching private certificate data and keep email configuration server-only. Existing Resend environment names are not an implemented notification service. Configure institutional timezone, recipients, thresholds and retention before enabling any sender. A user request for automation suggestions does not authorize sending messages.

First priorities: filename validation, immediate transfer reconciliation, assignment integrity monitoring, then review reminders. Automated review decisions and points awards are excluded.
