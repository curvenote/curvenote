# Plan: Upload Thumbnail Persistence

## Goal

Persist the thumbnail a user selects in the work upload form's "Choose a Thumbnail"
section. Today the selection is UI-only (`ChooseThumbnailSection` holds the chosen
index in local `useState` with no server write). We want the selected image
materialised into storage on submission and resolvable for display (e.g. the
secondary navigation on the work details page).

This is a follow-up to the metadata-extract feature, which already extracts images
from the uploaded DOCX via `officeparser` and renders them in the thumbnail picker.

## Current baseline

### What the extraction gives us

Each candidate image is an `officeparser` `OfficeAttachment`
([`node_modules/officeparser/dist/types.d.ts:572`]). The only string fields are:

- `name` — auto-generated (e.g. `image1.png`); only unique within one document and
  not guaranteed stable across re-parses. **Too weak to use as an identifier.**
- `extension`, `mimeType` — format only.
- `altText?` — often empty.
- `ocrText?` — only when OCR is enabled (we do not enable it).
- `data` — base64 of the image bytes.
- `chartData?` — charts only.

There is **no content hash** from `officeparser`. The only durable identifier is one
we derive by hashing the decoded image bytes, namespaced with the source document's
md5 (already available on every file as `metadata.files[path].md5`, and used as the
`docx:preview:${md5}` preview-cache key):

```
thumbnailId = `${sourceFileMd5}:${md5(decode(attachment.data))}`
```

### How thumbnails are stored / resolved today

There is **no thumbnail column** on `Work` / `WorkVersion`. Thumbnails are derived
entirely from published CDN content:

- `WorkVersion` stores only `cdn` + `cdn_key` (a pointer to the published MyST
  manifest on the CDN — see `cdnWorkVersionSelect`).
- The thumbnail URL lives inside the MyST manifest/frontmatter on the CDN.
  `getThumbnailBuffer` ([`packages/cdn/src/loaders.ts:369`]) fetches `config.json`
  and follows
  `config.thumbnail ?? projects[0].thumbnail ?? projects[0].pages.find(p => p.thumbnail)?.thumbnail`.
  Frontmatter `thumbnail`/`thumbnailOptimized` are rewritten to CDN URLs at build
  time ([`packages/cdn/src/utils.ts:184`]).
- Read path for the secondary nav: `work.links.thumbnail`
  ([`packages/scms-server/src/backend/loaders/works/get.server.ts:37`]) is only
  populated when `version.cdn && version.cdn_key` exist, pointing at
  `/api/v1/works/$workId/thumbnail` ([`v1.works.$workId.thumbnail.tsx`]), which again
  resolves via `getThumbnailBuffer`.
- CLI path: `myst` reads `thumbnail` from frontmatter/config, uploads the image to the
  CDN, the manifest references it, and the DB only learns `cdn` + `cdn_key`.

### The gap

A draft work version in the upload form has file storage (`work.cdn` is set —
`fetchPreviews` signs against it) but **no published manifest (`cdn_key`)**. So the
existing thumbnail mechanism cannot serve a draft's thumbnail. We need a parallel
persistence path until/unless a build produces a manifest.

## Decisions (confirmed)

- **Storage location:** a dedicated `metadata.thumbnail` key holds the _preferred_
  thumbnail (path + content hash + source path). Resolution falls back in layers:
  1. `metadata.thumbnail` (the user's explicit selection) — preferred
  2. `frontmatter.myst.thumbnail` (MyST-authored)
  3. published CDN manifest via `getThumbnailBuffer` (current behaviour)
- **Materialise timing:** on final form submission / Continue (not eagerly on select),
  to match "upload as part of the form submission" and avoid orphaned assets from idle
  selection changes.

## Proposed implementation

### 1. Client — send a stable id, not an index

`ChooseThumbnailSection` currently tracks `selectedIndex`. Change it to compute and
submit the derived `thumbnailId` (content hash) of the selected figure, included in
the Continue/confirm submission payload.

### 2. Server — materialise on submit

In the `confirm-work` (Continue) action:

1. Resolve the selected `thumbnailId` back to its base64 `data` from the cached
   preview AST (`docx:preview:${md5}` rows; note the AST is truncated to the first
   page, so the thumbnail candidates must come from data the picker actually had).
2. Decode and upload the image into the **same storage prefix as the work's other
   files**, keyed by content hash, e.g. `thumbnails/${imageHash}.${ext}`.
3. Record it in `workVersion.metadata.thumbnail`:

```jsonc
{
  "thumbnail": {
    "path": "thumbnails/<imageHash>.png",
    "contentHash": "<imageHash>",
    "sourcePath": "<docx path in metadata.files>",
    "mimeType": "image/png",
  },
}
```

Use `safeWorkVersionJsonUpdate` (optimistic locking) for the metadata write, matching
the metadata-extract action.

### 3. Read/display — layered resolver

Add a resolver (used by the work thumbnail loader and `get.server.ts` link builder)
that prefers, in order:

1. `metadata.thumbnail.path` → sign against `work.cdn` and serve.
2. `metadata['frontmatter.myst'].thumbnail` → sign/serve.
3. Existing `getThumbnailBuffer({ cdn, cdn_key })` when a published manifest exists.

`work.links.thumbnail` must be populated when (1) or (2) is present even if `cdn_key`
is absent, so draft uploads surface their thumbnail in the secondary nav.

## Open questions / risks

- **Preview AST truncation:** previews are truncated to `FIRST_PAGE_CONTENT_LIMIT`
  nodes, but `attachments` are stored in full on the cached AST. Confirm the selected
  image's bytes are always retrievable from the cache at submit time (or re-parse the
  source on submit if not).
- **Image size:** base64 attachments can be large; consider a max size / optional
  downscaling when materialising, to keep thumbnails lightweight.
- **Cleanup:** content-hash keying naturally dedupes; decide whether to prune
  superseded thumbnail assets when the selection changes between submissions.
- **Validation:** when formal schema validation lands, include `metadata.thumbnail`
  in the schema under `schemas/`.
