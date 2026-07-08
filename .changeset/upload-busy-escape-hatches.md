---
'@curvenote/scms': patch
---

Add escape hatches to the upload metadata-extract busy states. After 20s of preview generation, the document preview offers a "skip the preview" link that abandons the unpack and suppresses the follow-on auto-extraction so the user can proceed manually. After 15s of AI extraction, the metadata form offers a "skip AI extraction" link that clears the overlay for manual entry. Both reset when a fresh upload starts a new preview generation, and an explicit re-run overrides a prior skip. Removing the last manuscript file from the upload area now also stops any in-flight preview and extraction busy state immediately.
