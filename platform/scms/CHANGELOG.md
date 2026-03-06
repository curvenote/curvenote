# @curvenote/scms

## 0.15.2

### Patch Changes

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Improve account linking toasts

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Invalidate oauth2 cookies

- Updated dependencies [[`0549478`](https://github.com/curvenote/curvenote/commit/0549478873a8ba42f31fda6a013b63c0c156169d), [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1), [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1)]:
  - @curvenote/scms-core@0.15.2
  - @curvenote/scms-server@0.15.2
  - @curvenote/scms-sites-ext@0.15.2
  - @curvenote/scms-db@0.15.2

## 0.15.1

### Patch Changes

- [#807](https://github.com/curvenote/curvenote/pull/807) [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297) Thanks [@fwkoch](https://github.com/fwkoch)! - Linking/unlinking toasts

- [#807](https://github.com/curvenote/curvenote/pull/807) [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297) Thanks [@fwkoch](https://github.com/fwkoch)! - Allow old token issuers

- Updated dependencies [[`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297), [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297)]:
  - @curvenote/scms-server@0.15.1
  - @curvenote/scms-core@0.15.1
  - @curvenote/scms-sites-ext@0.15.1
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

- [#794](https://github.com/curvenote/curvenote/pull/794) [`de4b1dd`](https://github.com/curvenote/curvenote/commit/de4b1ddb60a7bc21e500cb6678cee00c0ff5352c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Additional filtering and debug feaures for MyWorks

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Add editor account creation on signup

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - New version timeline and updates work details page

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - New form UI

- Updated dependencies [[`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72)]:
  - @curvenote/scms-db@0.15.0
  - @curvenote/scms-server@0.15.0
  - @curvenote/scms-core@0.15.0
  - @curvenote/scms-sites-ext@0.15.0
  - @curvenote/common@0.4.0
  - @curvenote/cdn@0.4.0

## 0.14.4

### Patch Changes

- [#791](https://github.com/curvenote/curvenote/pull/791) [`8102142`](https://github.com/curvenote/curvenote/commit/810214283496689c5e13aba206ec41a7e7b6fa42) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Do not show draft works or works/workVersions that have submissions with only DRAFT status
  Do not show submissions/submissionVersions with DRAFT status

- [#775](https://github.com/curvenote/curvenote/pull/775) [`6c9f095`](https://github.com/curvenote/curvenote/commit/6c9f0954ef2056e316eb960dec2f85d38ab5a865) Thanks [@fwkoch](https://github.com/fwkoch)! - Add early access CTA for works upload

- Updated dependencies []:
  - @curvenote/scms-core@0.14.4
  - @curvenote/scms-server@0.14.4
  - @curvenote/scms-db@0.14.4
  - @curvenote/scms-sites-ext@0.14.4

## 0.14.3

### Patch Changes

- Updated dependencies [[`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998)]:
  - @curvenote/scms-sites-ext@0.14.3
  - @curvenote/scms-core@0.14.3
  - @curvenote/scms-db@0.14.3
  - @curvenote/scms-server@0.14.3

## 0.14.2

### Patch Changes

- [#784](https://github.com/curvenote/curvenote/pull/784) [`ac62dd3`](https://github.com/curvenote/curvenote/commit/ac62dd3ea84be2609acef0519ea2ba8080a2533c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Make the "Analytics Events" page available to platform administrators

- Updated dependencies [[`ac62dd3`](https://github.com/curvenote/curvenote/commit/ac62dd3ea84be2609acef0519ea2ba8080a2533c), [`cced401`](https://github.com/curvenote/curvenote/commit/cced40124322a6c92de1783824cb213e8251c809), [`534825a`](https://github.com/curvenote/curvenote/commit/534825aef6a58ea34d012cc318fcb84057afb649)]:
  - @curvenote/scms-core@0.14.2
  - @curvenote/scms-sites-ext@0.14.2
  - @curvenote/scms-server@0.14.2
  - @curvenote/scms-db@0.14.2

## 0.14.1

### Patch Changes

- [#778](https://github.com/curvenote/curvenote/pull/778) [`89be77d`](https://github.com/curvenote/curvenote/commit/89be77de9d7a3fd47618d24393cd23ff98423aa1) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Simplified the magic link functionality

- [#773](https://github.com/curvenote/curvenote/pull/773) [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix to ensure that the `task` flag in extension's configurations is honored on the dashboard

- [#773](https://github.com/curvenote/curvenote/pull/773) [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extend the ExtensionTask interfaces include optional scopes. Implement a function that can retreive available scoped tasks based on app configuration and current user scopes

- [#777](https://github.com/curvenote/curvenote/pull/777) [`5e288f6`](https://github.com/curvenote/curvenote/commit/5e288f60e542aaf07b6823380199503f14e0e025) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improvements to loading bar navigation

- Updated dependencies [[`14db863`](https://github.com/curvenote/curvenote/commit/14db86352774df714a757b79be6b14491aaf4f5a), [`89be77d`](https://github.com/curvenote/curvenote/commit/89be77de9d7a3fd47618d24393cd23ff98423aa1), [`d03740b`](https://github.com/curvenote/curvenote/commit/d03740b7eafaa0d457d71c2ab2c019ff27624090), [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4), [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4), [`5e288f6`](https://github.com/curvenote/curvenote/commit/5e288f60e542aaf07b6823380199503f14e0e025)]:
  - @curvenote/scms-core@0.14.1
  - @curvenote/scms-server@0.14.1
  - @curvenote/scms-sites-ext@0.14.1
  - @curvenote/scms-db@0.14.1

## 0.14.0

### Minor Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Upgrade to Prisma ORM v7

### Patch Changes

- [#767](https://github.com/curvenote/curvenote/pull/767) [`198d139`](https://github.com/curvenote/curvenote/commit/198d1393790a2a259d4c27036611f1117a2bdc94) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removed unused PageFrameProvider and simplified PageFrameProps. PageFrame and FrameHeader are not configurable from `.app-config.yml#app.pages` where configuration setting will override local props.

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extending app-config.schema to allow database DB certificate to be specified, prisma client functions now accept this string as an optional argument

- Updated dependencies [[`198d139`](https://github.com/curvenote/curvenote/commit/198d1393790a2a259d4c27036611f1117a2bdc94), [`97e5053`](https://github.com/curvenote/curvenote/commit/97e505314971983fe3a4d8c2c5844c7f29bfbed3), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0)]:
  - @curvenote/scms-core@0.14.0
  - @curvenote/scms-server@0.14.0
  - @curvenote/scms-db@0.14.0
  - @curvenote/scms-sites-ext@0.14.0

## 0.13.2

### Patch Changes

- [#764](https://github.com/curvenote/curvenote/pull/764) [`84fbc25`](https://github.com/curvenote/curvenote/commit/84fbc25be6b3b4aab07edb40ebf7a7dfa186c3ba) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Outbound emails not logged as messages and introducing `$schema`s for JSON fields on the `Message` table entries

- [#766](https://github.com/curvenote/curvenote/pull/766) [`33f29c6`](https://github.com/curvenote/curvenote/commit/33f29c6841b1943a8780dde2de1306973db9b79a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Added a configuration "Help" menu item to the primary navigation bar

- Updated dependencies [[`b423ca5`](https://github.com/curvenote/curvenote/commit/b423ca58429a279ce2589038d9fb5ae314893461), [`84fbc25`](https://github.com/curvenote/curvenote/commit/84fbc25be6b3b4aab07edb40ebf7a7dfa186c3ba), [`33f29c6`](https://github.com/curvenote/curvenote/commit/33f29c6841b1943a8780dde2de1306973db9b79a)]:
  - @curvenote/scms-core@0.13.2
  - @curvenote/scms-server@0.13.2
  - @curvenote/scms-sites-ext@0.0.2
