---
'@curvenote/scms-server': patch
'@curvenote/scms-core': patch
'@curvenote/scms': patch
---

Rename `app.webVersionPreviewUrl` to `app.workVersionPreviewUrl`. Hardcode preview JWT audiences (`scms-preview` for submissions, `scms-work-preview` for work versions) beside the existing scope constants in preview token minting.
