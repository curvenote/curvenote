---
'@curvenote/scms-db': patch
---

Speed up work-keyed FK lookups flagged by Supabase advisor.

- **Submission:** btree `Submission_work_id_idx` on `work_id` for `/my/submissions?work_id=…`, ETL register-work, and work teardown.
- **WorkUser:** btree `WorkUser_work_id_idx` on `work_id` for work → `work_users` joins (e.g. after DOI resolution) and work teardown.
