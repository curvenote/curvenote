---
'@curvenote/common': minor
'@curvenote/scms-server': minor
---

**Breaking:** `SiteDTO.tags` no longer includes the internal catalog `id`. Each tag is
now `{ name, label }` (`TagRefDTO`); key on `name`, which is unique per site and
URL-safe. This affects every payload built by `formatSiteDTO`: `GET /v1/sites/:siteName`,
the sites listing, `my/sites`, and the site update response.
