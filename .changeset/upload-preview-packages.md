---
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
'@curvenote/scms-doc-preview': patch
'@curvenote/scms': patch
---

Extract upload document preview, metadata extraction, and related UI into shared packages

- Add `@curvenote/scms-doc-preview` for the manuscript preview/extract/thumbnail server pipeline
- Add a thin Anthropic client and work-version metadata/checks helpers to `@curvenote/scms-server`
- Move reusable upload/preview UI and adapters into `@curvenote/scms-core`
- Keep the upload route as a thin loader/action composition shell
