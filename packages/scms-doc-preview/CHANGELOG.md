# @curvenote/scms-doc-preview

## 0.28.1

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-core@0.28.1
  - @curvenote/scms-server@0.28.1
  - @curvenote/scms-db@0.28.1

## 0.28.0

### Patch Changes

- Updated dependencies [[`749e4a3`](https://github.com/curvenote/curvenote/commit/749e4a36cd81e64c3b9591d807ecea26a8d5be23), [`3a0c253`](https://github.com/curvenote/curvenote/commit/3a0c253670582c49d2a04fc08f6338d2f3653420), [`a0a1436`](https://github.com/curvenote/curvenote/commit/a0a14367e750a3a306bba5714f0f67fb2d4aa4d2), [`e63c0eb`](https://github.com/curvenote/curvenote/commit/e63c0eb50ceeea766c3c2317ecb5ffafe7007bbf), [`b37915e`](https://github.com/curvenote/curvenote/commit/b37915e49a5de2bad6016a8b6a07daa8f95651fc), [`c520f82`](https://github.com/curvenote/curvenote/commit/c520f82c12cd1dd6b6fd92f2b16fa4bbe57200c3), [`7332122`](https://github.com/curvenote/curvenote/commit/7332122f5e234b8522bc3b91c415bdfc176d1478), [`1178a42`](https://github.com/curvenote/curvenote/commit/1178a4293bc80226e0ecda52d02d602351852bc8)]:
  - @curvenote/scms-core@0.28.0
  - @curvenote/scms-server@0.28.0
  - @curvenote/scms-db@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [[`dd67dab`](https://github.com/curvenote/curvenote/commit/dd67daba6879da9bc245828fd93df298e769009b), [`b2adb3e`](https://github.com/curvenote/curvenote/commit/b2adb3e78e5a2f4c860eeea0cb50bf5098d79bdb)]:
  - @curvenote/scms-core@0.27.0
  - @curvenote/common@0.9.0
  - @curvenote/scms-server@0.27.0
  - @curvenote/scms-db@0.27.0

## 0.26.1

### Patch Changes

- Updated dependencies [[`abe82ca`](https://github.com/curvenote/curvenote/commit/abe82cae178600ef6b256cce0c6bb5e115df83d6)]:
  - @curvenote/scms-core@0.26.1
  - @curvenote/scms-server@0.26.1
  - @curvenote/scms-db@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [[`e0184b9`](https://github.com/curvenote/curvenote/commit/e0184b9bafd53feadea8f5ed4db98fa87adcb6c6), [`93e3133`](https://github.com/curvenote/curvenote/commit/93e3133b9102a5e4a831f24b1bbcf2808930402a), [`1a86b7b`](https://github.com/curvenote/curvenote/commit/1a86b7b1afd7ac75a8e888790cf3c217105bca57)]:
  - @curvenote/scms-core@0.26.0
  - @curvenote/scms-server@0.26.0
  - @curvenote/common@0.8.0
  - @curvenote/scms-db@0.26.0

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
