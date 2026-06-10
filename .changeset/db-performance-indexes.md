---
'@curvenote/scms-db': patch
---

Add Supabase advisor btree indexes for FK columns that Postgres does not index automatically (migration `20260610140000_add_db_performance_indexes`, `CREATE INDEX CONCURRENTLY` for large production tables).

- **Submission** `work_id` — `/my/submissions?work_id=…`, ETL register-work, work teardown
- **WorkUser** `work_id` — work → `work_users` joins after DOI/work resolution, work teardown
- **WorkUser** `user_id` — `/my/works`, `/my/submissions` membership filter, `dbGetUserWorkRoles`
- **SubmissionVersion** `submission_id` — Submission → versions nested-loop joins
- **Schema** — declare `Work`/`WorkVersion` GIN trgm indexes in Prisma so `migrate dev` does not generate spurious DROP migrations
