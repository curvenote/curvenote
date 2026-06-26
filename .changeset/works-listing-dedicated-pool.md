---
'@curvenote/scms-db': patch
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Give the public works listing/search endpoint (`/api/v1/sites/:siteName/works`)
its own dedicated database connection pool so its heavy listing/search/count
queries draw from a separate connection budget and cannot exhaust the shared
app-wide pool (and vice versa). `scms-db` now exposes
`getNamedLowLevelPrismaClient(name, …)` for per-name isolated clients/pools, and
`scms-server` adds `getWorksListingPrismaClient()` which uses the same database
and identical per-pool tuning as the default client. The whole endpoint path,
including the shared subject lookups, is routed through the dedicated pool.

Note: each named pool adds up to its own `max` connections to the backend, so
the total connection budget is now the sum across pools — size accordingly
against the database / pooler limits.
