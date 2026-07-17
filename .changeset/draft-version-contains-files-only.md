---
'@curvenote/scms-server': patch
---

UI create-new-version / draft upload versions no longer inherit prior `contains` labels (e.g. `myst`); drafts start as `files`-only until the converter merges `myst`. CLI register/push still set `contains: ['myst']` explicitly.
