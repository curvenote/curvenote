---
'@curvenote/scms-sites-ext': patch
---

Declare `myst-to-jats` as a direct dependency so `build:scms` builds it. `crossref-utils-sdk` imports
it, and in the monorepo it resolves to the workspace package, which Turbo did not build because no
workspace package depended on it.
