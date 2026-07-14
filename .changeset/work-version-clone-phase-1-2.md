---
'@curvenote/scms-server': patch
'@curvenote/scms': minor
---

Add platform work-version cloning for new draft versions. Introduce `cloneDraftWorkVersionFromSource` with an injectable `seedMetadataFromSource` hook (flow-agnostic base seeder in core), reference-copied files, and best-effort document preview cache seeding; lift preview cache helpers into `@curvenote/scms-core`. Article create-new-version clones from the latest non-draft predecessor and uses an article seeder that keeps frontmatter while dropping inherited files, upload analysis, and preview thumbnail listings (selected thumbnail still inherits via `workVersion.thumbnail`). Draft resume is relaxed and routes PMC drafts to deposit vs article upload. Upload UI shows inherited thumbnails with a pinned Current tile and accepts stored thumbnail keys on confirm. Extract `shouldDeleteUploadedFileFromStorage` as the single policy for multi-version file removal, with unit and handler tests. Resume-draft dialogs show `v{n}` version tags on list items; tune `VersionTagBadge` padding for readability.
