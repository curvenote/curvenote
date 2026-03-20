# @curvenote/scms-core

## 0.15.5

### Patch Changes

- [#803](https://github.com/curvenote/curvenote/pull/803) [`3025543`](https://github.com/curvenote/curvenote/commit/302554357f2233caad98fd9d28dfe7cad82397e1) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving links in all slack messages

- Updated dependencies []:
  - @curvenote/scms-db@0.15.5

## 0.15.4

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-db@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-db@0.15.3

## 0.15.2

### Patch Changes

- [#803](https://github.com/curvenote/curvenote/pull/803) [`0549478`](https://github.com/curvenote/curvenote/commit/0549478873a8ba42f31fda6a013b63c0c156169d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding the SplitButton component

- [#817](https://github.com/curvenote/curvenote/pull/817) [`f1b4256`](https://github.com/curvenote/curvenote/commit/f1b425684e1f7c8d59c8a584dffe0be562447e6d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Setup feature flag for prototype checks features

- Updated dependencies []:
  - @curvenote/scms-db@0.15.2

## 0.15.1

### Patch Changes

- [#807](https://github.com/curvenote/curvenote/pull/807) [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297) Thanks [@fwkoch](https://github.com/fwkoch)! - Linking/unlinking toasts

- [#807](https://github.com/curvenote/curvenote/pull/807) [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297) Thanks [@fwkoch](https://github.com/fwkoch)! - Allow old token issuers

- Updated dependencies []:
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

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Adding a github oauth2 auth module

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Add editor account creation on signup

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - New form UI

- Updated dependencies [[`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72)]:
  - @curvenote/scms-db@0.15.0
  - @curvenote/common@0.4.0
  - @curvenote/cdn@0.4.0

## 0.14.4

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-db@0.14.4

## 0.14.3

### Patch Changes

- [`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Force package bump because of CI release failure on 0.14.2

- Updated dependencies [[`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998)]:
  - @curvenote/scms-db@0.14.3

## 0.14.2

### Patch Changes

- [#784](https://github.com/curvenote/curvenote/pull/784) [`ac62dd3`](https://github.com/curvenote/curvenote/commit/ac62dd3ea84be2609acef0519ea2ba8080a2533c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Make the "Analytics Events" page available to platform administrators

- Updated dependencies []:
  - @curvenote/scms-db@0.14.2

## 0.14.1

### Patch Changes

- [#776](https://github.com/curvenote/curvenote/pull/776) [`14db863`](https://github.com/curvenote/curvenote/commit/14db86352774df714a757b79be6b14491aaf4f5a) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fixes duplicate keys when no section names are provided in the secondary menu data

- [#762](https://github.com/curvenote/curvenote/pull/762) [`d03740b`](https://github.com/curvenote/curvenote/commit/d03740b7eafaa0d457d71c2ab2c019ff27624090) Thanks [@fwkoch](https://github.com/fwkoch)! - 📋 Basic forms for submissions to sites, site admin facing so far.

- [#773](https://github.com/curvenote/curvenote/pull/773) [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix to ensure that the `task` flag in extension's configurations is honored on the dashboard

- [#773](https://github.com/curvenote/curvenote/pull/773) [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extend the ExtensionTask interfaces include optional scopes. Implement a function that can retreive available scoped tasks based on app configuration and current user scopes

- [#777](https://github.com/curvenote/curvenote/pull/777) [`5e288f6`](https://github.com/curvenote/curvenote/commit/5e288f60e542aaf07b6823380199503f14e0e025) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improvements to loading bar navigation

- Updated dependencies []:
  - @curvenote/scms-db@0.14.1

## 0.14.0

### Minor Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Upgrade to Prisma ORM v7

### Patch Changes

- [#767](https://github.com/curvenote/curvenote/pull/767) [`198d139`](https://github.com/curvenote/curvenote/commit/198d1393790a2a259d4c27036611f1117a2bdc94) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removed unused PageFrameProvider and simplified PageFrameProps. PageFrame and FrameHeader are not configurable from `.app-config.yml#app.pages` where configuration setting will override local props.

- [#767](https://github.com/curvenote/curvenote/pull/767) [`97e5053`](https://github.com/curvenote/curvenote/commit/97e505314971983fe3a4d8c2c5844c7f29bfbed3) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Client filterabel lists can be set to reactive to respond to external changes

- Updated dependencies [[`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0)]:
  - @curvenote/scms-db@0.14.0

## 0.13.2

### Patch Changes

- [#766](https://github.com/curvenote/curvenote/pull/766) [`b423ca5`](https://github.com/curvenote/curvenote/commit/b423ca58429a279ce2589038d9fb5ae314893461) Thanks [@github-actions](https://github.com/apps/github-actions)! - Extended InviteUserDialog to accept an email address

- [#764](https://github.com/curvenote/curvenote/pull/764) [`84fbc25`](https://github.com/curvenote/curvenote/commit/84fbc25be6b3b4aab07edb40ebf7a7dfa186c3ba) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Outbound emails not logged as messages and introducing `$schema`s for JSON fields on the `Message` table entries

- [#766](https://github.com/curvenote/curvenote/pull/766) [`33f29c6`](https://github.com/curvenote/curvenote/commit/33f29c6841b1943a8780dde2de1306973db9b79a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Added a configuration "Help" menu item to the primary navigation bar
