---
'@curvenote/scms': minor
---

Add platform work-version cloning for new draft versions. Introduce `cloneDraftWorkVersionFromSource` with metadata sanitization, reference-copied files, and best-effort document preview cache seeding; lift preview cache helpers into `@curvenote/scms-core`. Article create-new-version clones from the latest non-draft predecessor; draft resume is relaxed and routes PMC drafts to deposit vs article upload. Upload UI shows inherited thumbnails with a pinned Current tile and accepts stored thumbnail keys on confirm. Extract `shouldDeleteUploadedFileFromStorage` as the single policy for multi-version file removal, with unit and handler tests. Resume-draft dialogs show `v{n}` version tags on list items; tune `VersionTagBadge` padding for readability.
