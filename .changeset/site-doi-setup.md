---
'@curvenote/scms-core': patch
'@curvenote/scms-sites-ext': minor
---

Add Site > DOI Registration: a site admin chooses Curvenote-managed registration or the
site's own Crossref prefix (Enterprise, behind `site.data.doiCustomPrefixEnabled`), and a
system admin links the Crossref role, which is validated against Crossref before the site
becomes active. Adds `api.crossref.prefix` and `api.crossref.role` to the app config. The
screen is gated per user by the `app:sites:doi:feature` scope, granted through a Role (e.g.
`doi-preview`).
