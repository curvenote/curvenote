---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Add injectable `seedMetadataFromSource` to work-version cloning. Article create-new-version drops inherited files, upload analysis, and preview thumbnail listings while keeping frontmatter; core default seeding is flow-agnostic.
