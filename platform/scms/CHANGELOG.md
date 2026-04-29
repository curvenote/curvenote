# @curvenote/scms

## 0.16.1

### Patch Changes

- [#866](https://github.com/curvenote/curvenote/pull/866) [`06b4530`](https://github.com/curvenote/curvenote/commit/06b4530d9b105f8419c957bebccbda5a4ee30002) Thanks [@stevejpurves](https://github.com/stevejpurves)! - System admin can set users to anonymous via the UI. Added confirmation dialogs for changes to sensitive roles.

- [#868](https://github.com/curvenote/curvenote/pull/868) [`cb2bd34`](https://github.com/curvenote/curvenote/commit/cb2bd348a95271abc22fc381277b6b4c3cb0e331) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extended system/design page and provided an interface point for extensions to export design components, sinplifying extension development, testing and review

- Updated dependencies [[`cb2bd34`](https://github.com/curvenote/curvenote/commit/cb2bd348a95271abc22fc381277b6b4c3cb0e331)]:
  - @curvenote/scms-core@0.16.1
  - @curvenote/scms-sites-ext@0.16.1
  - @curvenote/scms-server@0.16.1
  - @curvenote/scms-db@0.16.1

## 0.16.0

### Minor Changes

- [#849](https://github.com/curvenote/curvenote/pull/849) [`cce3d6a`](https://github.com/curvenote/curvenote/commit/cce3d6a4a0e99ab266bac9c38405636b867c799a) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding the `checks-relay` service and it's supporting packages

- [#859](https://github.com/curvenote/curvenote/pull/859) [`087bb79`](https://github.com/curvenote/curvenote/commit/087bb79435b44d4d166cd8f9904d98845e564adf) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Moving system roles to the database and enabling system admins to update these dynamically. This is a step towards integrating roless into a single consistent RBAC patterns, although further change will be required this step enables manual maigrations and role level feature flag implementation accross all user accounts

### Patch Changes

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Suppress server `Context.trackEvent` for browser GET/HEAD data loads (`Sec-Fetch-Dest: empty`), including React Router single-fetch revalidation and polling-style fetches. Add `EventOptions.forceTrackPolls` to opt back in. Rely on the shared guard from the work layout loader instead of a route-local check.

- [#861](https://github.com/curvenote/curvenote/pull/861) [`a11ab4f`](https://github.com/curvenote/curvenote/commit/a11ab4f3c17518899903d86afa1536b005843d43) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improve works /check page UI and wiring to check service extensions

- [#856](https://github.com/curvenote/curvenote/pull/856) [`fa79c02`](https://github.com/curvenote/curvenote/commit/fa79c02ccaf041ab9703638ae6a85e1ec878dfd7) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix page width containment regression in `MainWrapper`. Restores flex-child width clamping by adding `min-w-0`, so wide descendant content no longer overflows the main column and blows out the layout when the primary and secondary navs are shown. This preserves the previous behaviour without reintroducing `overflow-hidden`, keeping sticky/overflowing children visible.

- [#841](https://github.com/curvenote/curvenote/pull/841) [`bee3418`](https://github.com/curvenote/curvenote/commit/bee3418d23a820b9d2343fd43332cf19fc71c245) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add a loopback job for pubsub and dispatch system testing

- [#860](https://github.com/curvenote/curvenote/pull/860) [`8d52b54`](https://github.com/curvenote/curvenote/commit/8d52b5486dda7e70cbe65d6e4d68e9186d10907f) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Exposing global / top level works scopes on system roles UI

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Adding defensive early rejection and 404 caching on key routes

- [#850](https://github.com/curvenote/curvenote/pull/850) [`a3123a4`](https://github.com/curvenote/curvenote/commit/a3123a4efd088d78c28a5a10bbd1f6fb35aca76d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removing block out div on mobile navigation drawer

- [#853](https://github.com/curvenote/curvenote/pull/853) [`8beebc6`](https://github.com/curvenote/curvenote/commit/8beebc6f48492661fa8585cf3f1f1a9f3d5c81ec) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Restrict iframes and add CSP in report mode

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix `withAppScopedContext` silently redirecting instead of throwing 401 when `{ redirect: true }` is not set.

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix infinite redirect loop at `/app/settings` for users with `app:settings:read` but no sub-scopes. The `/app/settings` loader previously redirected unconditionally to `/app/settings/account`, which in turn redirected to `/app` when the user lacked `app:settings:account:read`; `/app` then redirected back to `/app/settings` via the default-route resolver. The loader now redirects to the first settings sub-page the user can actually access (using the same menu builder the secondary nav uses) and falls through to an inline "no settings available" placeholder when no sub-page is reachable.

- [#842](https://github.com/curvenote/curvenote/pull/842) [`1828a5a`](https://github.com/curvenote/curvenote/commit/1828a5a9c59cc081062105a8ef5836a75e9e4b63) Thanks [@github-actions](https://github.com/apps/github-actions)! - Titles for videos are optional

- [#860](https://github.com/curvenote/curvenote/pull/860) [`8d52b54`](https://github.com/curvenote/curvenote/commit/8d52b5486dda7e70cbe65d6e4d68e9186d10907f) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Scope structure and enforcement changes around works

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding finer grains scopes to scms app

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Allow extensions to expose defined scopes over ServerExtension interface

- Updated dependencies [[`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d), [`a11ab4f`](https://github.com/curvenote/curvenote/commit/a11ab4f3c17518899903d86afa1536b005843d43), [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d), [`fa79c02`](https://github.com/curvenote/curvenote/commit/fa79c02ccaf041ab9703638ae6a85e1ec878dfd7), [`6f63f5e`](https://github.com/curvenote/curvenote/commit/6f63f5ec90252a871aa850d1393526692af20c9a), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236), [`bee3418`](https://github.com/curvenote/curvenote/commit/bee3418d23a820b9d2343fd43332cf19fc71c245), [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d), [`cce3d6a`](https://github.com/curvenote/curvenote/commit/cce3d6a4a0e99ab266bac9c38405636b867c799a), [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d), [`a3123a4`](https://github.com/curvenote/curvenote/commit/a3123a4efd088d78c28a5a10bbd1f6fb35aca76d), [`8beebc6`](https://github.com/curvenote/curvenote/commit/8beebc6f48492661fa8585cf3f1f1a9f3d5c81ec), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236), [`087bb79`](https://github.com/curvenote/curvenote/commit/087bb79435b44d4d166cd8f9904d98845e564adf), [`1828a5a`](https://github.com/curvenote/curvenote/commit/1828a5a9c59cc081062105a8ef5836a75e9e4b63), [`8d52b54`](https://github.com/curvenote/curvenote/commit/8d52b5486dda7e70cbe65d6e4d68e9186d10907f), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236)]:
  - @curvenote/scms-core@0.16.0
  - @curvenote/scms-server@0.16.0
  - @curvenote/scms-sites-ext@0.16.0
  - @curvenote/scms-db@0.16.0

## 0.15.6

### Patch Changes

- [`26a0cf2`](https://github.com/curvenote/curvenote/commit/26a0cf21061b72c8544efcad4add5d8c4f95a309) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Added dispatch endpoints and reorganised backend job handling code

- [#836](https://github.com/curvenote/curvenote/pull/836) [`f9911d7`](https://github.com/curvenote/curvenote/commit/f9911d7a6fac6669d76e46850f2529d4e3280cbe) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add dispatch endpoints and setup for pubsub

- Updated dependencies [[`26a0cf2`](https://github.com/curvenote/curvenote/commit/26a0cf21061b72c8544efcad4add5d8c4f95a309), [`f9911d7`](https://github.com/curvenote/curvenote/commit/f9911d7a6fac6669d76e46850f2529d4e3280cbe)]:
  - @curvenote/scms-server@0.15.6
  - @curvenote/scms-sites-ext@0.15.6
  - @curvenote/scms-core@0.15.6
  - @curvenote/scms-db@0.15.6

## 0.15.5

### Patch Changes

- [#803](https://github.com/curvenote/curvenote/pull/803) [`44a17d3`](https://github.com/curvenote/curvenote/commit/44a17d3e8c7483e8048fe4668cb5c6ef79fe6d67) Thanks [@stevejpurves](https://github.com/stevejpurves)! - clean up experimental works routes

- [#828](https://github.com/curvenote/curvenote/pull/828) [`3f9d0ae`](https://github.com/curvenote/curvenote/commit/3f9d0aebde855ab9df12e020f12f01b16a52928d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving the package sent with the analytics.identify call to include roles and scopes. Updating the user via identify when the user's settigns are changed by the platform administrator

- [#831](https://github.com/curvenote/curvenote/pull/831) [`010d781`](https://github.com/curvenote/curvenote/commit/010d7818a46e7265b47ca1959154901ccc79549c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Moving schemas to central location

- [#814](https://github.com/curvenote/curvenote/pull/814) [`a350156`](https://github.com/curvenote/curvenote/commit/a35015615fa37b752938ea93e02a066584740414) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding BlueSky auth provider

- [#803](https://github.com/curvenote/curvenote/pull/803) [`3025543`](https://github.com/curvenote/curvenote/commit/302554357f2233caad98fd9d28dfe7cad82397e1) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving links in all slack messages

- Updated dependencies [[`3f9d0ae`](https://github.com/curvenote/curvenote/commit/3f9d0aebde855ab9df12e020f12f01b16a52928d), [`010d781`](https://github.com/curvenote/curvenote/commit/010d7818a46e7265b47ca1959154901ccc79549c), [`a350156`](https://github.com/curvenote/curvenote/commit/a35015615fa37b752938ea93e02a066584740414), [`3025543`](https://github.com/curvenote/curvenote/commit/302554357f2233caad98fd9d28dfe7cad82397e1)]:
  - @curvenote/scms-server@0.15.5
  - @curvenote/scms-core@0.15.5
  - @curvenote/scms-sites-ext@0.15.5
  - @curvenote/scms-db@0.15.5

## 0.15.4

### Patch Changes

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Surface inbound email processing errors and warnings

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving content in slack pings to include clickable links

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Show html message bodies for outgoing emails

- Updated dependencies [[`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34), [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34), [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34), [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34)]:
  - @curvenote/scms-server@0.15.4
  - @curvenote/scms-sites-ext@0.15.4
  - @curvenote/scms-core@0.15.4
  - @curvenote/scms-db@0.15.4

## 0.15.3

### Patch Changes

- [#821](https://github.com/curvenote/curvenote/pull/821) [`76f89a2`](https://github.com/curvenote/curvenote/commit/76f89a2873982f7a82a75978068ab4886440f962) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add caching headers to endpoints affected by burt traffic

- [#823](https://github.com/curvenote/curvenote/pull/823) [`2c4308c`](https://github.com/curvenote/curvenote/commit/2c4308c5e40da28044f7528728a09804b4cff166) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Return min client version in v1/config

- Updated dependencies [[`2c4308c`](https://github.com/curvenote/curvenote/commit/2c4308c5e40da28044f7528728a09804b4cff166), [`6d5955f`](https://github.com/curvenote/curvenote/commit/6d5955f55f20b306703d0a387ae930c9a3c19a69)]:
  - @curvenote/scms-server@0.15.3
  - @curvenote/scms-sites-ext@0.15.3
  - @curvenote/scms-core@0.15.3
  - @curvenote/scms-db@0.15.3

## 0.15.2

### Patch Changes

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Improve account linking toasts

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Invalidate oauth2 cookies

- [#817](https://github.com/curvenote/curvenote/pull/817) [`f1b4256`](https://github.com/curvenote/curvenote/commit/f1b425684e1f7c8d59c8a584dffe0be562447e6d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Setup feature flag for prototype checks features

- Updated dependencies [[`0549478`](https://github.com/curvenote/curvenote/commit/0549478873a8ba42f31fda6a013b63c0c156169d), [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1), [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1), [`f1b4256`](https://github.com/curvenote/curvenote/commit/f1b425684e1f7c8d59c8a584dffe0be562447e6d)]:
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
