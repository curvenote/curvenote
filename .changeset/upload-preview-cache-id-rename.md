---
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Rename version-scoped document preview cache Object ids from `docx:preview:v3:` to `upload:preview:` (PDF and DOCX alike). Delete legacy `docx:preview:v3`, `docx:preview:v2`, and md5-only rows on confirm-work cleanup, draft work deletion, and preview artifact removal. When cloning a draft version, seed preview cache from legacy source rows when the new-prefix row is absent.
