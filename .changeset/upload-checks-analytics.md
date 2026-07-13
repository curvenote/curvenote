---
'@curvenote/scms': patch
---

Add Segment analytics for the upload metadata flow and extension check platform glue. Track document preview and metadata extraction lifecycle events (started, completed, failed) with `uploadFlowTrigger` for auto vs manual retry/rerun, plus `extractedImageCount` on successful previews when figure extraction ran. On upload confirm, emit checks analytics only for check services whose extensions register upload-confirmed events. Wire checks page viewed and `analyticsTrigger` passthrough for extension check actions via generic extension analytics catalogs.
