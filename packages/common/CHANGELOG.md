# @curvenote/common

## 0.2.13

### Patch Changes

- d289e1c: Add date_published to submssion types

## 0.2.12

### Patch Changes

- 942427f: Extending `SiteWorkDTO` with Submission Version Id.

## 0.2.11

### Patch Changes

- fdb85f8: Added `clientProxyUrl` and `gitPullerTargetUrl` to the theme Jupyter configuration for dedicated hubs.
  Added `openInServerRoot` to prevent attempts to open files that do not exist.
  `jupyter` key content is now uniform across the different locations in the theme config.
- 8ef9ac3: Extended SiteDTO with restricted field

## 0.2.10

### Patch Changes

- b430454: Bump myst versions
- Updated dependencies [b430454]
  - @curvenote/blocks@1.5.29

## 0.2.9

### Patch Changes

- 2a28d5d: Update myst and dependencies
- Updated dependencies [2a28d5d]
  - @curvenote/blocks@1.5.28

## 0.2.8

### Patch Changes

- 20d9914: Update packages

## 0.2.7

## 0.2.6

### Patch Changes

- 6af3af6: Added `dedicatedHub` option to `JupyterFeatureConfig`

## 0.1.46

### Patch Changes

- 62e873c: Updates to footers and theme

## 0.1.45

### Patch Changes

- 91f969d: Adding `enable` flag to `JournalThemeConfig.listing`
- 1a5b6aa: Updates to myst-theme

## 0.1.44

### Patch Changes

- b3a8e71: Bumping `myst` dependencies, whihc should pin `thebe` to `0.4.7`

## 0.1.43

### Patch Changes

- 2a53cca: Moved packages from `journals` monorepo

## 0.1.42

## 0.1.41

### Patch Changes

- 9f8f927: Added Discourse to SocialIcons

## 0.1.40

### Patch Changes

- 635e8fc: Extend JournalTheme jupyter configuration to optionally enable lite and allow for per article settings for mecaBundle, binderOverride and allowLite.

## 0.1.39

### Patch Changes

- 61fd248: Remove maps from UploadStagingDTO

## 0.1.38

### Patch Changes

- bc032e0: UploadStagingDTO now returns lists of items as well as maps

## 0.1.37

### Patch Changes

- 46d2dad: - Rename `Site` (metadata) to `SiteConfig` and nove `url` field to `SiteDTO`
  - Remove `submission_cdn` from `SiteDTO`

## 0.1.36

### Patch Changes

- 4c38de2: Extend HeroConfig types for boxed layout

## 0.1.35

## 0.1.34

## 0.1.33

## 0.1.32

### Patch Changes

- 4e17f84: deprecating `kind` as string and `kind_id`.
  removing `kind?` from `WorkVersion`

## 0.1.31

### Patch Changes

- 225dee4: Added `content` `Json` field with specific `title` and `description` optional keys to `SubmissionKindDTO` and updated `CollectionDTO.content` to the same.

## 0.1.30

### Patch Changes

- 4b660ef: Follow through on deprecating previous submission version behaviour
- 4b660ef: Remove some invalid links
- 6e78a59: Extending JournalThemeConfig to include `styles.body`
- 4b660ef: Get/list/create submission versions

## 0.1.29

### Patch Changes

- c7b7500: Add primary slug to SubmissionListItemDTO when set
- c7b7500: Extended JournalThemeConfig with kicker, fonts and changes to CTA types

## 0.1.28

### Patch Changes

- b7d2294: Upgrade dependencies

## 0.1.27

## 0.1.26

### Patch Changes

- 869db09: A collection is now requried on a submission
- 869db09: Adding workflow to Site and Collection DTOs
- 70fdb1f: Added pagination fields to SiteWorkListingDTO

## 0.1.25

## 0.1.24

### Patch Changes

- a10acb7: JournalThemeConfig now supports allows an array of CTAs to be provided

## 0.1.23

### Patch Changes

- c346e57: Remove some links from WorkDTO

## 0.1.22

### Patch Changes

- efccf08: `logo-url` set to optional in `JournalThemeConfig`
- 3bed420: Extending types for collections support
- 8afd245: Update types to allow work without

## 0.1.21

### Patch Changes

- 220bc90: Bump dependencies

## 0.1.20

### Patch Changes

- a13e9ea: Type changes for JournalThemeConfig
- e46291b: Extended types

## 0.1.19

### Patch Changes

- e26473d: Added upload specific types

## 0.1.18

### Patch Changes

- 36adf4b: Export Check types

## 0.1.17

### Patch Changes

- 9bb8dfa: Submission Listing and Submission type changes

## 0.1.16

## 0.1.15

### Patch Changes

- 464cdb1: Added a "logo url" to be used from the site's logo in place of the "url" which is the location that the site is hosted at

## 0.1.14

## 0.1.13

### Patch Changes

- b2369e2: Moved myst deps to plain dependencies, not peer deps

## 0.1.12

## 0.1.11

### Patch Changes

- 6891a2c: Bump all myst deps

## 0.1.10

### Patch Changes

- b9802f5: 👊 bump `myst-config`

## 0.1.9

### Patch Changes

- 3299af3: Extending JournalThemeConfig for extended hero unit options

## 0.1.8

### Patch Changes

- 6c6b3dc: Extended JournalTheme type to allow for per-kind article layout configuration in addition to a base set of defaults
- 0f5373a: Extended SiteDTO type

## 0.1.7

### Patch Changes

- e8e2abd: Extending theme config types
- 9b76e47: Site url added to SiteDTO type

## 0.1.6

### Patch Changes

- 7d3c99c: Added types for common Journal Theme configuration object

## 0.1.5

### Patch Changes

- 8bbd5b1: Making JobBody types stricter by changing strings to expected server-side enums
- 15ef4e5: Upgrade to latest `myst-*`, `@myst-theme/*`
- 4b158d1: bump `myst-*` and `@myst-theme`

## 0.1.4

### Patch Changes

- e976d6c: Added types for post/patch job request bodies

## 0.1.3

### Patch Changes

- 98625a4: Expanded submission listing dto to include additional summary information

## 0.1.2

### Patch Changes

- bb1cdd1: Added checks array to SubmissionKindsDTO, Refactored WorkDTO and added SiteWorkDTO. Updated Host to include named object type HostSpec and extended object to include `query` field for signed url support.

## 0.1.1

## 0.1.0

### Patch Changes

- 53cec38: Expanded WorkVersionDTO to carry `key` field

## 0.0.14

### Patch Changes

- a9dcd9a: Move to ESM only

## 0.0.13

## 0.0.12

## 0.0.11

## 0.0.10

### Patch Changes

- 8165596: Add content for a site
- 3e80866: Add additional social icons

## 0.0.9

### Patch Changes

- d22fe42: Format authors functions
- a8809ac: Add authors as an object
- bc60c14: Add social images and links

## 0.0.8

### Patch Changes

- fd1a4ba: Move from source --> site
- 3db830d: Add versions to work DTOs

## 0.0.7

### Patch Changes

- e554b28: Updates to journal types

## 0.0.6

## 0.0.5

## 0.0.4

### Patch Changes

- 6cbb1b7: Update to use @curvenote/common for types
