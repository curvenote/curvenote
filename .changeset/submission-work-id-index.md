---
'@curvenote/scms-db': patch
---

Speed up Submission lookups keyed by work.

- **Index:** add btree `Submission_work_id_idx` on `Submission.work_id` for `/my/submissions?work_id=…`, ETL register-work, and work teardown queries that were scanning without an FK index.
