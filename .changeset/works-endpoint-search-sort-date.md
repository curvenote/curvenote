---
'@curvenote/scms': minor
---

Add `q`, `sort`, `from`, and `to` query params to the public works listing endpoint (`GET /v1/sites/:siteName/works`). `q` runs a case-insensitive substring search across each work version's title, authors, and DOI (backed by the existing pg_trgm indexes); `sort` toggles publication-date ordering (`published_desc` default / `published_asc`); `from`/`to` apply an inclusive `date_published` window. Pagination links now preserve these params.
