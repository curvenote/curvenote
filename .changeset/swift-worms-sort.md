---
"@curvenote/cli": patch
"curvenote": patch
---

`curvenote submit` now uses the sites API for uploads, draft submissions by default go to temporary cdn, uploads will re-try 3 times, and can optionally also try to resume
