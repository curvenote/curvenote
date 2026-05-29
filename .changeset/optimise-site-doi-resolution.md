---
'@curvenote/scms-server': patch
'@curvenote/scms-db': patch
'@curvenote/scms': patch
---

Optimise the site DOI endpoint (`GET /v1/sites/:site/doi/:first/:second`).

- **Correctness:** the no-tag path is now scoped to the requesting site. Previously it resolved a DOI published on _any_ site, so a DOI could leak a work from a different site; it now 404s like the tag path.
- **Indexes:** added btree indexes on `Work.doi`, `WorkVersion.doi`, and `SubmissionVersion.work_version_id` (the existing trigram GIN indexes only serve `LIKE`/search, and the FK was unindexed), so DOI equality lookups and the DOI→published-version join no longer sequential-scan.
- **Query:** unified the tag and no-tag paths into a single `SubmissionVersion`-rooted lookup over a shared `where` builder, letting `ORDER BY date_created DESC` + `LIMIT 1` short-circuit at the first match.
- **Payload:** a narrower select (`siteWorkDtoSelect`) drops the `submitted_by` → `User` join and the submission-version bookkeeping columns the DTO never reads; `formatSiteWorkDTO` now accepts the narrower `SiteWorkDtoInput` (existing callers pass a structural superset and are unaffected).
- **Caching:** the route now sets Vercel cache headers — semi-static for successful lookups and a burst-protection preset for 404s — so the CDN absorbs repeat traffic (including DOI-scanner probes) instead of the origin/DB.
