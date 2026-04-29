# @curvenote/scms-core

## 0.16.1

### Patch Changes

- [#868](https://github.com/curvenote/curvenote/pull/868) [`cb2bd34`](https://github.com/curvenote/curvenote/commit/cb2bd348a95271abc22fc381277b6b4c3cb0e331) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extended system/design page and provided an interface point for extensions to export design components, sinplifying extension development, testing and review

- Updated dependencies []:
  - @curvenote/scms-db@0.16.1

## 0.16.0

### Minor Changes

- [#849](https://github.com/curvenote/curvenote/pull/849) [`cce3d6a`](https://github.com/curvenote/curvenote/commit/cce3d6a4a0e99ab266bac9c38405636b867c799a) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding the `checks-relay` service and it's supporting packages

- [#859](https://github.com/curvenote/curvenote/pull/859) [`087bb79`](https://github.com/curvenote/curvenote/commit/087bb79435b44d4d166cd8f9904d98845e564adf) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Moving system roles to the database and enabling system admins to update these dynamically. This is a step towards integrating roless into a single consistent RBAC patterns, although further change will be required this step enables manual maigrations and role level feature flag implementation accross all user accounts

### Patch Changes

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Suppress server `Context.trackEvent` for browser GET/HEAD data loads (`Sec-Fetch-Dest: empty`), including React Router single-fetch revalidation and polling-style fetches. Add `EventOptions.forceTrackPolls` to opt back in. Rely on the shared guard from the work layout loader instead of a route-local check.

- [#861](https://github.com/curvenote/curvenote/pull/861) [`a11ab4f`](https://github.com/curvenote/curvenote/commit/a11ab4f3c17518899903d86afa1536b005843d43) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improve works /check page UI and wiring to check service extensions

- [#856](https://github.com/curvenote/curvenote/pull/856) [`fa79c02`](https://github.com/curvenote/curvenote/commit/fa79c02ccaf041ab9703638ae6a85e1ec878dfd7) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix page width containment regression in `MainWrapper`. Restores flex-child width clamping by adding `min-w-0`, so wide descendant content no longer overflows the main column and blows out the layout when the primary and secondary navs are shown. This preserves the previous behaviour without reintroducing `overflow-hidden`, keeping sticky/overflowing children visible.

- [#842](https://github.com/curvenote/curvenote/pull/842) [`6f63f5e`](https://github.com/curvenote/curvenote/commit/6f63f5ec90252a871aa850d1393526692af20c9a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Export BadgeVariant type

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix malformed `/app//<path>` URLs when navigation item paths are configured with a leading slash. `resolveAccessibleDefaultRoute` now returns nav paths without leading or trailing slashes so the `/app` landing loader can safely concatenate `'/app/' + target`, and `PrimaryNav` normalizes the path the same way when building `NavLink` destinations, so redirects and rendered nav links stay in sync.

- [#841](https://github.com/curvenote/curvenote/pull/841) [`bee3418`](https://github.com/curvenote/curvenote/commit/bee3418d23a820b9d2343fd43332cf19fc71c245) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add a loopback job for pubsub and dispatch system testing

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Updating AyncComboBox and underling Command components to allow for clearing of selections in inline mode via a trailing action prop on comands

- [#850](https://github.com/curvenote/curvenote/pull/850) [`a3123a4`](https://github.com/curvenote/curvenote/commit/a3123a4efd088d78c28a5a10bbd1f6fb35aca76d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removing block out div on mobile navigation drawer

- [#842](https://github.com/curvenote/curvenote/pull/842) [`1828a5a`](https://github.com/curvenote/curvenote/commit/1828a5a9c59cc081062105a8ef5836a75e9e4b63) Thanks [@github-actions](https://github.com/apps/github-actions)! - Titles for videos are optional

- [#860](https://github.com/curvenote/curvenote/pull/860) [`8d52b54`](https://github.com/curvenote/curvenote/commit/8d52b5486dda7e70cbe65d6e4d68e9186d10907f) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Scope structure and enforcement changes around works

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding finer grains scopes to scms app

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Allow extensions to expose defined scopes over ServerExtension interface

- Updated dependencies []:
  - @curvenote/scms-db@0.16.0

## 0.15.6

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-db@0.15.6

## 0.15.5

### Patch Changes

- [#831](https://github.com/curvenote/curvenote/pull/831) [`010d781`](https://github.com/curvenote/curvenote/commit/010d7818a46e7265b47ca1959154901ccc79549c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Moving schemas to central location

- [#814](https://github.com/curvenote/curvenote/pull/814) [`a350156`](https://github.com/curvenote/curvenote/commit/a35015615fa37b752938ea93e02a066584740414) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding BlueSky auth provider

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
