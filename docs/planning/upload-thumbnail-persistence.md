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

## Decisions

- **Storage location (revised):** add a first-class **`thumbnail String?` column on
  `WorkVersion`** as the _preferred/override_ slot (holds the storage path/key of the
  user-selected, materialised image — not a signed URL, which would expire). Resolution
  falls back in layers:
  1. `workVersion.thumbnail` (column — the user's explicit selection) — preferred
  2. `metadata['frontmatter.myst'].thumbnail` (MyST-authored) — JSON fallback
  3. published CDN manifest via `getThumbnailBuffer` (current behaviour)

  This supersedes the earlier "dedicated `metadata.thumbnail` JSON key" idea. A nullable
  scalar keeps hot read paths lean (no need to select/parse the whole `metadata` blob to
  know if a thumbnail exists), is queryable/indexable, and avoids the shared-JSON-key
  write race between the upload flow and the ETL `frontmatter.myst` writer (flagged in
  the PR #312 review). Migration is non-breaking (nullable, no backfill).

- **Materialise timing:** on final form submission / Continue (not eagerly on select),
  to match "upload as part of the form submission" and avoid orphaned assets from idle
  selection changes.
- **Image processing:** resize/normalise with `sharp` before upload (see implementation
  step 2). SCMS runs on a Node server (`@react-router/express` / `@react-router/node`),
  so the native `sharp` addon is viable; import it dynamically to keep it off the route
  cold-start path (same pattern as the deferred `officeparser` import).

## Proposed implementation

### 1. Client — send a stable id, not an index

`ChooseThumbnailSection` currently tracks `selectedIndex`. Change it to compute and
submit the derived `thumbnailId` (content hash) of the selected figure, included in
the Continue/confirm submission payload.

### 2. Server — materialise on submit (with `sharp`)

In the `confirm-work` (Continue) action:

1. Resolve the selected `thumbnailId` back to its base64 `data` from the cached
   preview AST (`docx:preview:${md5}` rows; note the AST is truncated to the first
   page, so the thumbnail candidates must come from data the picker actually had).
2. Decode to a `Buffer`, then normalise with `sharp` (dynamic import):
   resize to fit inside ~512px (preserve aspect), strip EXIF, output webp (~80%).
   Cap excessively large inputs.
3. Upload the processed buffer into the **same storage prefix as the work's other
   files** via `IStorageProvider.writeBuffer(bucket, key, buffer, contentType)`,
   keyed by content hash, e.g. `thumbnails/${imageHash}.webp` (no presigned
   round-trip required — this is a server-side write).
4. Persist the storage path to the new `workVersion.thumbnail` column (typed update,
   not a JSON merge).

### 3. Read/display — single centralized resolver across app + API

All thumbnail reads currently funnel through `cdnlib.getThumbnailBuffer({ cdn, cdn_key })`
(manifest-only). Introduce one scms-server resolver,
`resolveWorkVersionThumbnail(ctx, workVersion, { query })`, applying the cascade:

1. `workVersion.thumbnail` (column) → sign against `work.cdn` and serve.
2. `metadata['frontmatter.myst'].thumbnail` → sign/serve.
3. `getThumbnailBuffer({ cdn, cdn_key })` when a published manifest exists.

Plus a companion `hasResolvableThumbnail(workVersion)` predicate for link builders so
`links.thumbnail` is emitted when (1) or (2) exist **even without `cdn_key`** — the key
change that lets draft uploads surface in the work-details secondary nav.

**Read surface to update (every call site must go through the resolver):**

Buffer-serving endpoints:

- `platform/scms/app/routes/api/v1.works.$workId.thumbnail.tsx`
- `packages/scms-server/.../loaders/sites/works/thumbnail.server.ts`
- `packages/scms-server/.../loaders/sites/works/versions/thumbnail.server.ts`
- `packages/scms-server/.../loaders/sites/works/social.server.ts`

Link/URL builders (gate on `hasResolvableThumbnail`):

- `packages/scms-server/.../loaders/works/get.server.ts` (`work.links.thumbnail`)
- sites works `format.server.ts` (listing)
- submissions `get.server.ts` variants
- `signPrivateUrls` (appends the signing query to the resolved URL)

Selecting the column is cheap; the resolver only needs `cdn`, `cdn_key`, and
`thumbnail` for the common case, and `metadata` only when falling through to layer (2).

## Runtime impact of the resize

- **Frequency:** once per submit, on a single selected image — not a per-request render
  path (reads serve a pre-made file from storage). Cost is paid once per upload.
- **Latency:** ~10–50ms for a typical embedded image (decode-dominated); ~100–300ms for
  a pathologically large figure. Source bytes are already in memory (cached preview
  AST), so there's no extra download. Small next to the `writeBuffer` upload and the
  existing check dispatch in the same action, and far lighter than the `officeparser`
  parse already done at preview.
- **Event loop:** `sharp`/libvips runs encode/decode on the libuv threadpool (native
  threads), so it does not block the JS main thread; concurrent requests are unaffected.
- **Cold start / memory:** first `await import('sharp')` loads the native binary once
  per process (deferred, so off the cold-start path). Steady-state memory for occasional
  single-image work is negligible; `sharp.cache(false)` available if needed.
- **Tail guard:** cap input size and set `sharp({ limitInputPixels })` to bound memory
  and time for oversized images.

## Open questions / risks

- **Preview AST truncation:** previews are truncated to `FIRST_PAGE_CONTENT_LIMIT`
  nodes, but `attachments` are stored in full on the cached AST. Confirm the selected
  image's bytes are always retrievable from the cache at submit time (or re-parse the
  source on submit if not).
- **`sharp` in CI/deploy:** native addon — ensure the target-platform prebuilt binary
  is installed in CI and the deploy image (don't strip optional deps). Dynamic-import
  it so it stays off the route cold-start path.
- **Cleanup:** content-hash keying naturally dedupes; decide whether to prune
  superseded thumbnail assets when the selection changes between submissions.
- **Migration:** `thumbnail String?` on `WorkVersion` is additive/nullable; no backfill
  needed. Add to the relevant prisma selects (`cdnWorkVersionSelect` and the listing
  selects) so the resolver can read it without widening to the full `metadata` blob.
