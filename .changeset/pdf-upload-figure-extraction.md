---
'@curvenote/scms': patch
---

Add a fast pdfjs path for PDF figure extraction during upload phase B (thumbnail gallery), with a 99-page scan cap and existing 24-figure limit. Skip tiny/oversized rasters before BMP materialization, dedupe repeated XObject paints, and show a PDF-specific gallery busy message. Remove the redundant All Figures preview tab, move `resolvePreviewImagePresence` to a client-safe module, and retry thumbnail extraction when phase B returns no figures.
