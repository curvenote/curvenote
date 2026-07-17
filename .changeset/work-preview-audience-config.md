---
'@curvenote/scms-server': patch
'@curvenote/scms-core': patch
'@curvenote/scms': patch
---

Rename `app.webVersionPreviewUrl` to `app.workVersionPreviewUrl`. Add required `api.previewAudience` and `api.workPreviewAudience`; preview token minting takes an explicit audience so submission previews use `previewAudience` and work-version previews use `workPreviewAudience`.
