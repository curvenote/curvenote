---
'@curvenote/scms': patch
'@curvenote/scms-db': patch
---

Improve My Works listing metadata and timeline affordances. Broaden the activity pill to the latest work- or submission-level event, reorder the right column to date then activity then timeline (baseline-aligned and centered), show the timeline link only when a work has multiple versions, and add `v{n}` badges to the work-details version timeline headers. Includes an Activity `(work_id, date_created)` index for efficient listing queries.
