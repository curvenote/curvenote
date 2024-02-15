# curvenote

## 0.8.38

### Patch Changes

- eebf3ef: During submit the SubmissonKind checks are run, a check report is displayed and a json copy is uploaded to cdn with the site
- 093e75b: Fix check output when all successful
- e6c11bb: Add checks to plugin interface
- a4ba250: Collect programmatic logs for submission

## 0.8.37

### Patch Changes

- 0dd7061: Update to myst 1.1.40

## 0.8.36

### Patch Changes

- 84752f6: Added `--draft` option to submit workflow, along with more options to include GitHub oriented source information

## 0.8.35

### Patch Changes

- 7bfeb75: Enable users to update another's submission if they are in the same curvenote team
- fb07682: Additional change to ensure flat projects when `sync.clone` is used from the client library.
- ee2db32: Improves auth & token cli to handle mulitple tokens
- 1c720b9: Adding prompt to protect against unintended overwrite of local files during `curvenote clone`

## 0.8.34

### Patch Changes

- ffd5cbe: `curvenote init` now creates a flat project/site when initializing from curvenote. This brings behaviour into line with initializing from a local folder.

## 0.8.33

### Patch Changes

- 49e8ccf4: Consume myst v1.1.34

## 0.8.32

### Patch Changes

- 139843ac: On pull, tags on the article block are mapped into the keywords frontmatter field

## 0.8.31

### Patch Changes

- 16ddad2f: Move common into curvenote deps
- a2a30dd1: Move to myst 1.1.33

## 0.8.30

### Patch Changes

- 61f1f7a: Move to myst 1.1.27
- 8cb1507: Update to myst v1.1.31

## 0.8.29

### Patch Changes

- 5a4b4d54: `curvenote submit` now makes an explicit check for a user's access rights, prior to starting the build and submission process.

## 0.8.28

### Patch Changes

- b0fb12ae: Added `curvenote submissions list`
- b0fb12ae: Added `curvenote submit` in place of `curvenote works create` & `curvenote works submit`

## 0.8.27

### Patch Changes

- 18bc3bd5: Consume MyST config loading changes
- 3d74ae41: Now using `cdn` and `key` when handling works and submissions
- 18bc3bd5: Export some deploy / publish utils

## 0.8.26

### Patch Changes

- b9ad6717: Save clones on session

## 0.8.25

### Patch Changes

- f450ec90: `works create` now triggers a clean rebuild of the exports and site
- 78647fb7: Aligned `init --write-toc` behaviour with mystmd

## 0.8.24

### Patch Changes

- 6733e6b0: Enabled local and staging environments via token api claim.
- 9d022d0e: Added `works` command and enabled work creation and venue (journal) submission to curvenote's staging journal deployment.

## 0.8.23

### Patch Changes

- 11bd87bd: Modify checks so they run on a MyST project, not a single file

## 0.8.22

### Patch Changes

- e210119c: Extending mimetype support for file writing via the mime-types package.

## 0.8.21

### Patch Changes

- d0a4fb74: Update curvenote exports for check functions

## 0.8.20

### Patch Changes

- f418c3f9: Add check functionality to cli for manuscript validation

## 0.8.19

### Patch Changes

- 9b59c23f: Fix oxa links in site build

## 0.8.18

### Patch Changes

- 7715d21: Update to myst 1.1.10

## 0.8.17

### Patch Changes

- 006be64: Update to v1.1.6

## 0.8.16

### Patch Changes

- Updates to mystmd

## 0.8.15

### Patch Changes

- 9f3f15d: Update myst-cli

## 0.8.14

### Patch Changes

- 450c9ab: Fix project path when exporting from a curvenote url
- 450c9ab: Return all temp folders and log files from export functions

## 0.8.13

### Patch Changes

- b122528: Update to esm modules
- 9548cdf: Updates to myst 0.1.31
- Updated dependencies [b122528]
- Updated dependencies [9548cdf]
  - @curvenote/blocks@1.5.24

## 0.8.12

### Patch Changes

- 9c0ddd6: Update to myst 0.1.30

## 0.8.11

### Patch Changes

- 70c88f5: Update to myst 0.1.29

## 0.8.10

### Patch Changes

- 2090f1e: Update myst to 0.1.28
- Updated dependencies [2090f1e]
  - @curvenote/blocks@1.5.23

## 0.8.9

### Patch Changes

- 5ca33fd: Updates to myst
- Updated dependencies [5ca33fd]
  - @curvenote/blocks@1.5.22

## 0.8.8

### Patch Changes

- 75601d2: Add --domain option to deploy for alternative domain

## 0.8.7

### Patch Changes

- 2646bf7: Upgrade to myst 0.1.19
- Updated dependencies [2646bf7]
  - @curvenote/blocks@1.5.21

## 0.8.6

### Patch Changes

- b2480fd: Upgrade to myst 0.1.17
- Updated dependencies [b2480fd]
  - @curvenote/blocks@1.5.20

## 0.8.5

### Patch Changes

- 5339cb0: Upgrade to mystjs 0.1.15
- Updated dependencies [5339cb0]
  - @curvenote/blocks@1.5.19

## 0.8.4

### Patch Changes

- b10b327: Updates to SVG in PDF and Word documents.
- Upgrade to myst 0.1.8
- 6041700: Consume myst-cli for site build, clean commands
- Updated dependencies [6041700]
  - @curvenote/blocks@1.5.18

## 0.8.3

### Patch Changes

- b8a97ee: Add part to block export
- fea62f2: Fix oxa exports so artifacts are correctly built by mystjs
  Provide function to reload the session object
- Updated dependencies [2d4bfbf]
- Updated dependencies [b8a97ee]
  - @curvenote/blocks@1.5.17

## 0.8.2

### Patch Changes

- Updated dependencies [68d411e]
  - @curvenote/site-common@0.0.18
  - myst-cli@0.0.4

## 0.8.1

### Patch Changes

- Updated dependencies
  - @curvenote/site-common@0.0.17
  - myst-cli@0.0.3

## 0.8.0

### Minor Changes

- 9c2be36: Change to an external theme server

### Patch Changes

- 1591111: Allow DOI checking to work offline, and fail with error that is not fatal
- 004dbcc: Ensure that bibtex folder is always created before write
- e3a2d05: Split standalone myst cli out of curvenote cli
- Updated dependencies [dbb283c]
- Updated dependencies [e3a2d05]
- Updated dependencies [de034db]
- Updated dependencies [e3a2d05]
- Updated dependencies [c9889c0]
- Updated dependencies [e3a2d05]
  - jtex@0.0.6
  - @curvenote/blocks@1.5.16
  - myst-config@0.0.2
  - @curvenote/site-common@0.0.16
  - intersphinx@0.0.3
  - myst-cli@0.0.2

## 0.7.1

### Patch Changes

- d999beb: Update card directive to not include title if not provided
- Updated dependencies [7808157]
- Updated dependencies [6c2ea00]
  - myst-transforms@0.0.7
  - jtex@0.0.5

## 0.7.0

### Minor Changes

- Major improvements to export functionality for tex, pdf, and word.

### Patch Changes

- Updated dependencies [4d560d1]
- Updated dependencies [4d560d1]
- Updated dependencies [c1f9051]
  - jtex@0.0.4
  - myst-to-tex@0.0.5
  - citation-js-utils@0.0.10

## 0.6.24

### Patch Changes

- 9f29922: Write intersphinx objects.inv on site build
- 438cb2d: Images and cards improved handling including height prop
- 7f11596: Deduplicate SiteConfig, SiteManifest types/validation
- ff79e9f: Pass construct and pass bib file directly to jtex
- Updated dependencies [a8e68ec]
- Updated dependencies [9b1fa05]
- Updated dependencies [b96c7a4]
- Updated dependencies [7f11596]
- Updated dependencies [ff79e9f]
- Updated dependencies [9b1fa05]
  - myst-transforms@0.0.6
  - intersphinx@0.0.2
  - @curvenote/blocks@1.5.15
  - @curvenote/site-common@0.0.15
  - jtex@0.0.3

## 0.6.23

### Patch Changes

- The package myst-utils was renamed to myst-common, we missed registering this by 7 hours. Super annoying, but it needs a bump across all packages.
- Updated dependencies
  - @curvenote/blocks@1.5.15
  - citation-js-utils@0.0.10
  - myst-frontmatter@0.0.2
  - intersphinx@0.0.2
  - jtex@0.0.3
  - myst-to-tex@0.0.4
  - myst-transforms@0.0.5
  - myst-common@0.0.3
  - @curvenote/site-common@0.0.14
  - simple-validators@0.0.2

## 0.6.22

### Patch Changes

- 327c19c: Introduce new link transforms for internal and external protocols including dois, rrids, wiki, and myst.
- de062e5: Add mermaid diagrams
- edf10cd: Introduce delete role for strikeout text
- a431f10: Explicitly set writeFolder for image copying during AST transformation
- edf10cd: Add dropdown class to admonitions
- 631ee7c: Create intersphinx package
- 5460169: Add intersphinx interoperability (read) as well as markdown links syntax for referencing.
- 327c19c: Deprecate rrid and wiki roles in favor of link syntax
- Updated dependencies [327c19c]
- Updated dependencies [6b4c188]
- Updated dependencies [a431f10]
- Updated dependencies [f6ad6c9]
- Updated dependencies [2f6e43a]
- Updated dependencies [f6ad6c9]
- Updated dependencies [edf10cd]
- Updated dependencies [f6ad6c9]
- Updated dependencies [631ee7c]
- Updated dependencies [5460169]
- Updated dependencies [2b85858]
  - myst-transforms@0.0.4
  - jtex@0.0.2
  - myst-to-tex@0.0.3
  - myst-common@0.0.2
  - @curvenote/site-common@0.0.13

## 0.6.21

### Patch Changes

- Updates to linking of packages

## 0.6.20

### Patch Changes

- 241154b: Improve logging around TOC, licenses, and npm
- 619328f: Improve cross-referencing of content in a book
- 8f87d52: Tab items can have whitespace in titles
- 619328f: Migrate to using vfile error reporting for some of the file errors
- 619328f: Bring transforms into the frontend to allow for improved demo component
- 619328f: Add wikipedia hover links
- 3099109: If frontmatter is the only block, it will now be removed
- Updated dependencies [619328f]
- Updated dependencies [619328f]
- Updated dependencies [619328f]
  - myst-transforms@0.0.2

## 0.6.19

### Patch Changes

- 4b5a4c9: Fetch bibliography items from remote URLs
- 9423af0: Add a `--keep-host` option for curvenote serve and by default use localhost for the value of the HOST environment variable.

## 0.6.18

### Patch Changes

- 58adf87: Added consistent-type-imports eslint rule
- 9ae455e: Improve install of @cuvenote/blocks in the monorepo
- Updated dependencies [58adf87]
- Updated dependencies [9ae455e]
  - @curvenote/blocks@1.5.14
  - citation-js-utils@0.0.9

## 0.6.17

### Patch Changes

- e29e889: Add blocks to monorepo, improve linting for development in other monorepos
- 2b15752: Change NPM requirements for >=7 and remove crossenv
- Updated dependencies [e29e889]
  - @curvenote/blocks@1.5.13
  - citation-js-utils@0.0.8

## 0.6.16

### Patch Changes

- c3fe4b6: Catch citation errors from stopping the build
- 3182d24: Support PDF images in html
- 54f2c4d: SI Units and chemical formulas as basic extensions
- Updated dependencies [1544132]
  - citation-js-utils@0.0.7

## 0.6.15

### Patch Changes

- 87ff5a2: Respect hidden documents in the navigation when pulling or cloning

## 0.6.14

### Patch Changes

- e66b049: Print versions on errors
- da41124: Add `mbox` support for math renderers
- e66b049: Remove write-toc option from the start command
- 3d68483: Update to mystjs 0.0.13
- e66b049: Remove the debug file output option
- 56a4682: Update mystjs to support colon fences
- ae093f6: Move `curvenote build` to the main CLI service
- ee7b327: Support adding a title on relative links to files
- 5cf656c: Update language around curvespace --> website
- b6dcd75: Relative links in `--write-toc` option
- 068bea8: Pull content for a single document
- 40fe45d: Look up all bibtex files on the current tree
- 53b3bec: Introduce `strict` and `check-links` parameters for the build process that can stop the build
- 367b3d5: Allow CLI to run on node v12
- 322574d: Update links in readme and CRT contributor roles
- e66b049: Make the curvenote --branch flag require an argument

## 0.6.13

### Patch Changes

- d220c0d: Never return empty slugs when removing enumeration

## 0.6.12

### Patch Changes

- e048508: Include directive should return if file doesn't exist

## 0.6.11

### Patch Changes

- 01f73de: - `include` added as a directive
  - `tab-set` and `tab-item` added as directives
- fb1364b: Recognize GitHub urls for images
- bc337d0: Added a MyST Demo Component
- b91c836: WebP translation is now only called on png, jpg, jpeg, tiff, or gif

## 0.6.10

### Patch Changes

- 0568d3b: Clone recursively when using locally.

## 0.6.9

### Patch Changes

- Fix bug for including fetch for downloading notebooks
- 801f7c7: Improve logging messages for errors in debug mode.

## 0.6.8

### Patch Changes

- c7830a4: Improve CI logging

## 0.6.7

### Patch Changes

- 53458c6: Logo can be missing for deploy

## 0.6.6

### Patch Changes

- e55abd4: The `curvenote clone` option can now take a -y flag to take the default path.
- 79707eb: Allow the logo to fail to exist, without stopping the site build
- 8ed82ad: Improve clone function to use remote config
- 0a1509c: Add remote site config to list of models that can be fetched from the curvenote API
- 1b23694: Update typescript and @curvenote/blocks
- 3fe1207: Allow project lookup with `@team/name` in addition to links
- Updated dependencies [0a1509c]
- Updated dependencies [1b23694]
  - @curvenote/blocks@1.5.9
  - citation-js-utils@0.0.6

## 0.6.5

### Patch Changes

- e3dcb6e: Replace a process.exit(1) with error in exported function outside CLI

## 0.6.4

### Patch Changes

- 444743f: Update the build to use `esbuild` as well as move all files to `ts` (no `xml` or `json`).

## 0.6.3

### Patch Changes

- c02461d: Expose `thumbnailOptimized` on the config passed to the renderer
- c02461d: Improve teh error message for image writing in thumbnails and normal images
- 3607491: Add alt text to images based on figure captions

## 0.6.2

### Patch Changes

- 40cf170: Deploy functions were split into two functions (#275)
- d89a0d8: `sourceUrl` has been renamed to `urlSource` for consistency with `urlOptimized`, this is backwards compatible.

## 0.6.1

### Patch Changes

- e00c445: Update images for npm publish, and improve terminology.
- 45e7cb6: Introduce `thumbnailOptimized` using webp and create images that have a srcset in the web output.

## 0.6.0

### Minor Changes

- 5655b82: Moved to packaging the CLI as a bundle and curve.space served as a monorepo.
