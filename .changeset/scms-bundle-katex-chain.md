---
'@curvenote/scms': patch
---

Bundle `crossref-utils-sdk`, `myst-to-jats`, `myst-transforms` and `katex` into the SCMS server build.
`myst-transforms` imports katex's raw ESM `mhchem` source, which Vercel's Node runtime loaded as
CommonJS and crashed on at startup.
