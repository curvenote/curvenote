---
'@curvenote/scms': patch
---

Improve the upload metadata-extract workflow. Auto-trigger extraction on a fresh 0→N manuscript upload when work details are still empty, retry when the fetcher returns idle after upload, and expose re-run and clear controls on the metadata form. Keep the active preview tab aligned as files are added or removed, and streamline the metadata form card layout for the upload route.
