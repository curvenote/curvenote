# Plan: Upload Thumbnail Persistence

> **Status (implemented):** The core thumbnail persistence is now in place:
>
> - `WorkVersion.thumbnail` nullable column + migration
>   (`20260617120000_add_work_version_thumbnail`).
> - `thumbnail` added to the lean WorkVersion selects and `WorkVersionDBO`.
> - `resolveWorkVersionThumbnail` + `hasResolvableThumbnail` cascade
>   (`packages/scms-server/src/backend/thumbnail.server.ts`): column (read direct from
>   storage) → published CDN manifest. The resolver never reads the `metadata` blob.
> - The 3 thumbnail buffer endpoints (internal work, site work, site work version) and
>   the `formatWorkDTO` link builder route through the cascade.
> - On `confirm-work`, the selected figure is resized/normalised with `sharp`
>   (≤512px, webp) and written to the work version's bucket; the storage key is saved
>   to `WorkVersion.thumbnail` (best-effort, never blocks submission).
> - The picker submits a stable `sourcePath\u0000figureIndex` locator (not a flattened
>   global index) via `thumbnailSelection.ts`.
>
> **Remaining TODO:** ETL endpoint optimisation (write `wv.thumbnail` from MyST
> frontmatter) — see "TODO" section below.

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
  user-selected, materialised image — not a signed URL, which would expire). The cascade
  is **two layers only**:
  1. `workVersion.thumbnail` (column — the user's explicit selection) — preferred
  2. published CDN manifest via `getThumbnailBuffer` (current behaviour)

  The `metadata['frontmatter.myst'].thumbnail` layer is intentionally **dropped**: when
  that key is set on a published work, the MyST build has already uploaded the image and
  the manifest's `config.thumbnail` points at it, so layer 2 resolves it anyway. The only
  uncovered case — `frontmatter.myst.thumbnail` set but not yet built/published — is
  covered for our flow because the upload form writes the column directly. This means the
  resolver **never reads the `metadata` JSON blob**, so the lean selects stay lean (no
  lazy metadata fetch needed).

  This supersedes the earlier "dedicated `metadata.thumbnail` JSON key" idea. A nullable
  scalar keeps hot read paths lean (no need to select/parse the whole `metadata` blob to
  know if a thumbnail exists), is queryable/indexable, and avoids the shared-JSON-key
  write race between the upload flow and the ETL `frontmatter.myst` writer (flagged in
  the PR #312 review). Migration is non-breaking (nullable, no backfill).

- **Efficiency:** the column path is strictly cheaper than the manifest path. The manifest
  path is two network ops (fetch+parse `config.json`, then fetch the image URL); the column
  path signs the storage URL locally (HMAC, no network) and either redirects the client to
  it (0 server-side fetches) or proxies a single fetch — skipping the `config.json`
  round-trip and parse entirely.

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
`resolveWorkVersionThumbnail(ctx, workVersion, { query })`, applying the two-layer cascade:

1. `workVersion.thumbnail` (column) → sign against `work.cdn` and serve/redirect
   (skips the manifest round-trip).
2. `getThumbnailBuffer({ cdn, cdn_key })` when a published manifest exists.

Plus a companion `hasResolvableThumbnail(workVersion)` predicate for link builders so
`links.thumbnail` is emitted when the column is set **even without `cdn_key`** — the key
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

Selecting the column is cheap; the resolver only needs `cdn`, `cdn_key`, and `thumbnail`.
The `metadata` JSON blob is never read by the resolver (the cascade has no
`frontmatter.myst` layer), so the lean selects (`cdnWorkVersionSelect` et al.) stay
metadata-free — just add the `thumbnail` scalar.

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

## TODO (this changeset)

- **ETL: populate `wv.thumbnail` from MyST frontmatter (optimization).** Update
  `register-work.server.ts` so that when `myst_metadata.thumbnail` is present it also
  writes the storage key to the new `thumbnail` column (alongside the existing
  `metadata['frontmatter.myst']` write). This is an _optimization_, not correctness:
  ETL-registered works already resolve via layer 2 (manifest), so this just lets them
  skip the `config.json` round-trip.
  - Small change (~15-20 lines + test): add a `thumbnail` field to `versionData` plus a
    helper to derive the value.
  - **Subtlety:** MyST `thumbnail` is a path relative to the article/`cdn_key` base
    (what `getThumbnailBuffer` + `updateUrl` resolve against), whereas the column must
    hold a key the resolver signs against `work.cdn` the same way upload-written keys
    are. Join `cdn_key`'s path with the relative MyST thumbnail path so layer 1 signs
    the correct URL.

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
