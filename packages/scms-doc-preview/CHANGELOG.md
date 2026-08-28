# @curvenote/scms-doc-preview

## 0.25.0

### Patch Changes

- Updated dependencies [[`959bcf4`](https://github.com/curvenote/curvenote/commit/959bcf4de568bb924974cd11949f08601105217a), [`7ceaaf4`](https://github.com/curvenote/curvenote/commit/7ceaaf4d7dea7fcfa168977d179ad085ea7952e4), [`320c3fb`](https://github.com/curvenote/curvenote/commit/320c3fbc2d16b651bca684cb363f0b642cd29649), [`e48a7d8`](https://github.com/curvenote/curvenote/commit/e48a7d870f62dbc572e1471b9f41b97b9ee25749)]:
  - @curvenote/scms-core@0.25.0
  - @curvenote/scms-server@0.25.0
  - @curvenote/scms-db@0.25.0

## 0.24.3

### Patch Changes

- [#1059](https://github.com/curvenote/curvenote/pull/1059) [`e9ea434`](https://github.com/curvenote/curvenote/commit/e9ea4348f73dc9eb85ead004b038d63215a81f79) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Allow document preview fetch handlers to scope phase A/B work to an optional `targetPath` (main manuscript) instead of always processing every preview candidate

- [#1059](https://github.com/curvenote/curvenote/pull/1059) [`e9ea434`](https://github.com/curvenote/curvenote/commit/e9ea4348f73dc9eb85ead004b038d63215a81f79) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix CDN object signing against local MinIO / path-style private CDN URLs by resolving the storage bucket via `knownBucketFromCDN` with a private-CDN hostname fallback (`resolveBucketForCdn`)

- [#1055](https://github.com/curvenote/curvenote/pull/1055) [`966468b`](https://github.com/curvenote/curvenote/commit/966468b6a5dfae0b5054409bdc6697c54dc257bf) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extract upload document preview, metadata extraction, and related UI into shared packages

  - Add `@curvenote/scms-doc-preview` for the manuscript preview/extract/thumbnail server pipeline
  - Add a thin Anthropic client and work-version metadata/checks helpers to `@curvenote/scms-server`
  - Move reusable upload/preview UI and adapters into `@curvenote/scms-core`
  - Keep the upload route as a thin loader/action composition shell

- Updated dependencies [[`ad989fe`](https://github.com/curvenote/curvenote/commit/ad989fe262369cfb19425b8d8191500d38718aec), [`e9ea434`](https://github.com/curvenote/curvenote/commit/e9ea4348f73dc9eb85ead004b038d63215a81f79), [`ad989fe`](https://github.com/curvenote/curvenote/commit/ad989fe262369cfb19425b8d8191500d38718aec), [`1d7f83a`](https://github.com/curvenote/curvenote/commit/1d7f83a0f190228d9be7bc9b768b982352bc5e78), [`e9ea434`](https://github.com/curvenote/curvenote/commit/e9ea4348f73dc9eb85ead004b038d63215a81f79), [`966468b`](https://github.com/curvenote/curvenote/commit/966468b6a5dfae0b5054409bdc6697c54dc257bf)]:
  - @curvenote/scms-core@0.24.3
  - @curvenote/scms-server@0.24.3
  - @curvenote/scms-db@0.24.3
