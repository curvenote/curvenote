---
'@curvenote/scms-db': patch
'@curvenote/scms-server': patch
'@curvenote/scms-core': patch
'@curvenote/scms-sites-ext': patch
'@curvenote/scms': patch
---

Activity feeds for Export to PDF and Start CHECKS; centralized activity type labels

- **scms-db**: New activity types `EXPORT_TO_PDF_STARTED` and `CHECK_STARTED` (Prisma schema + migration).
- **scms-server**: `createWorkActivity()` for work-scoped timeline activities.
- **scms-core**: `ACTIVITY_TYPE_LABELS`, `getActivityTypeLabel()`, and `formatCheckKind()` for shared activity labels; used by sites and platform.
- **scms-sites-ext**: Activity feed uses `getActivityTypeLabel` from scms-core (removed local `ACTIVITY_TYPES`).
- **scms**: Work details timeline logs Export to PDF and Check started activities; timeline uses `getActivityTypeLabel` from scms-core.
