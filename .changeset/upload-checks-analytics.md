---
'@curvenote/scms': patch
---

Add Segment analytics for the upload metadata flow and HHMI checks platform glue. Track document preview and metadata extraction lifecycle events (started, completed, failed) with `uploadFlowTrigger` for auto vs manual retry/rerun, plus `extractedImageCount` on successful previews when figure extraction ran. On upload confirm, emit checks analytics only for dispatchable HHMI check kinds (Variant B). Wire checks page viewed and `analyticsTrigger` passthrough for extension check actions.
