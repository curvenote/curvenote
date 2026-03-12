# @curvenote/scms-sites-ext

## 0.15.2

### Patch Changes

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Improve account linking toasts

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Invalidate oauth2 cookies

- Updated dependencies [[`0549478`](https://github.com/curvenote/curvenote/commit/0549478873a8ba42f31fda6a013b63c0c156169d), [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1), [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1), [`f1b4256`](https://github.com/curvenote/curvenote/commit/f1b425684e1f7c8d59c8a584dffe0be562447e6d)]:
  - @curvenote/scms-core@0.15.2
  - @curvenote/scms-server@0.15.2
  - @curvenote/scms-db@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies [[`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297), [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297)]:
  - @curvenote/scms-server@0.15.1
  - @curvenote/scms-core@0.15.1
  - @curvenote/scms-db@0.15.1

## 0.15.0

### Minor Changes

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Sugnififcant updgrade to support extension checks interfaces and new SCMS Work degigns

### Patch Changes

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Activity feeds for Export to PDF and Start CHECKS; centralized activity type labels
  - **scms-db**: New activity types `EXPORT_TO_PDF_STARTED` and `CHECK_STARTED` (Prisma schema + migration).
  - **scms-server**: `createWorkActivity()` for work-scoped timeline activities.
  - **scms-core**: `ACTIVITY_TYPE_LABELS`, `getActivityTypeLabel()`, and `formatCheckKind()` for shared activity labels; used by sites and platform.
  - **scms-sites-ext**: Activity feed uses `getActivityTypeLabel` from scms-core (removed local `ACTIVITY_TYPES`).
  - **scms**: Work details timeline logs Export to PDF and Check started activities; timeline uses `getActivityTypeLabel` from scms-core.

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extensions page and admin config: full-width cards, getSafeAdminConfig (ServerExtension), getExtensionAdminCard (ClientExtension), platform sanitizer and obfuscateSecret to avoid exposing secrets. Sites extension implements admin card and safe config.

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extensions page: reduced card padding, two-column grid for default and custom cards, admin cards render full content including title (extensionName/ExtensionIcon props), ExtensionCardBodyFallback extracted to own file.

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Add signin/signup from submission forms

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - New form UI

- Updated dependencies [[`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72)]:
  - @curvenote/scms-db@0.15.0
  - @curvenote/scms-server@0.15.0
  - @curvenote/scms-core@0.15.0
  - @curvenote/common@0.4.0

## 0.14.4

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-core@0.14.4
  - @curvenote/scms-server@0.14.4
  - @curvenote/scms-db@0.14.4

## 0.14.3

### Patch Changes

- [`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Force package bump because of CI release failure on 0.14.2

- Updated dependencies [[`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998)]:
  - @curvenote/scms-core@0.14.3
  - @curvenote/scms-db@0.14.3
  - @curvenote/scms-server@0.14.3

## 0.14.2

### Patch Changes

- [#783](https://github.com/curvenote/curvenote/pull/783) [`cced401`](https://github.com/curvenote/curvenote/commit/cced40124322a6c92de1783824cb213e8251c809) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix misleading error message

- [#787](https://github.com/curvenote/curvenote/pull/787) [`534825a`](https://github.com/curvenote/curvenote/commit/534825aef6a58ea34d012cc318fcb84057afb649) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Remove site link from SiteCard, add primary domain to site branding area in secondary nav

- Updated dependencies [[`ac62dd3`](https://github.com/curvenote/curvenote/commit/ac62dd3ea84be2609acef0519ea2ba8080a2533c)]:
  - @curvenote/scms-core@0.14.2
  - @curvenote/scms-server@0.14.2
  - @curvenote/scms-db@0.14.2

## 0.14.1

### Patch Changes

- [#778](https://github.com/curvenote/curvenote/pull/778) [`89be77d`](https://github.com/curvenote/curvenote/commit/89be77de9d7a3fd47618d24393cd23ff98423aa1) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Simplified the magic link functionality

- [#762](https://github.com/curvenote/curvenote/pull/762) [`d03740b`](https://github.com/curvenote/curvenote/commit/d03740b7eafaa0d457d71c2ab2c019ff27624090) Thanks [@fwkoch](https://github.com/fwkoch)! - 📋 Basic forms for submissions to sites, site admin facing so far.

- Updated dependencies [[`14db863`](https://github.com/curvenote/curvenote/commit/14db86352774df714a757b79be6b14491aaf4f5a), [`89be77d`](https://github.com/curvenote/curvenote/commit/89be77de9d7a3fd47618d24393cd23ff98423aa1), [`d03740b`](https://github.com/curvenote/curvenote/commit/d03740b7eafaa0d457d71c2ab2c019ff27624090), [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4), [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4), [`5e288f6`](https://github.com/curvenote/curvenote/commit/5e288f60e542aaf07b6823380199503f14e0e025)]:
  - @curvenote/scms-core@0.14.1
  - @curvenote/scms-server@0.14.1
  - @curvenote/scms-db@0.14.1

## 0.14.0

### Minor Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Upgrade to Prisma ORM v7

### Patch Changes

- Updated dependencies [[`198d139`](https://github.com/curvenote/curvenote/commit/198d1393790a2a259d4c27036611f1117a2bdc94), [`97e5053`](https://github.com/curvenote/curvenote/commit/97e505314971983fe3a4d8c2c5844c7f29bfbed3), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0)]:
  - @curvenote/scms-core@0.14.0
  - @curvenote/scms-server@0.14.0
  - @curvenote/scms-db@0.14.0

## 0.0.2

### Patch Changes

- Updated dependencies [[`b423ca5`](https://github.com/curvenote/curvenote/commit/b423ca58429a279ce2589038d9fb5ae314893461), [`84fbc25`](https://github.com/curvenote/curvenote/commit/84fbc25be6b3b4aab07edb40ebf7a7dfa186c3ba), [`33f29c6`](https://github.com/curvenote/curvenote/commit/33f29c6841b1943a8780dde2de1306973db9b79a)]:
  - @curvenote/scms-core@0.13.2
  - @curvenote/scms-server@0.13.2
