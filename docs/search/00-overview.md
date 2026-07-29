# Public works listing search

Technical notes for free-text search (`q`) on:

```
GET /v1/sites/:siteName/works
```

Implementation lives in
`platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts`
(`dbSearchSubmissionIds`). Clients such as the openrxiv reader pass `q` through
unchanged; method selection is entirely server-side.

## Two paths

| Path | When | Matching |
|------|------|----------|
| **Projection** (default) | `WORKS_SEARCH_PROJECTION_DISABLED` unset / not truthy | `SubmissionSearch` — FTS (`@@`) + pg_trgm word similarity (`<%`) |
| **Legacy ILIKE** | Kill-switch on: `WORKS_SEARCH_PROJECTION_DISABLED=true` \| `1` \| `on` | Global `WorkVersion` UNION of `ILIKE '%q%'` branches, then join to site submissions |

```text
useSearchProjection()  →  !WORKS_SEARCH_PROJECTION_DISABLED
```

Kill-switch is an ops escape hatch (instant fallback, no redeploy) if the
projection path misbehaves in an environment.

## Documents

| Document | Contents |
|----------|----------|
| [01-legacy-ilike.md](./01-legacy-ilike.md) | Legacy path: queries, tables, indexes, performance, fuzziness |
| [02-projection-submission-search.md](./02-projection-submission-search.md) | Default projection path (`SubmissionSearch`) |

## Shared request contract

Regardless of path:

- `q` shorter than **3** characters is dropped at the route (trigram-unfriendly).
- Search ids are intersected with optional `subject` ids, then the page query /
  count run through the shared `Submission` listing filter (`buildListingWhere`).
- Only submission versions in the requested status (`PUBLISHED` by default,
  `IN_REVIEW` when scoped to a collection) are considered.
