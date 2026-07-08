---
'@curvenote/scms': patch
---

Rework the upload metadata-extract document preview. Surface manuscript files in a dedicated preview card with scroll-capped content, code-point-safe tab title truncation, and explicit loading, error, and empty states. Use a hybrid character-budget first-page truncation for non-paged ASTs (notably DOCX) so previews gather enough front matter without walking unbounded tiny nodes.
