# curvenote

## 0.12.27

## 0.12.26

### Patch Changes

- [#739](https://github.com/curvenote/curvenote/pull/739) [`b2e6b1c`](https://github.com/curvenote/curvenote/commit/b2e6b1c2da5532f3c13834e359703f147dcd224d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adds a `--skip-build` option to `curvenote submit` to avoid the clean and rebuild step.

## 0.12.25

## 0.12.24

## 0.12.23

## 0.12.22

## 0.12.21

### Patch Changes

- [`c0b68a8`](https://github.com/curvenote/curvenote/commit/c0b68a813bf8d907505ee177bf4ed4616732fbf9) Thanks [@rowanc1](https://github.com/rowanc1)! - Releasing fixed readme links

## 0.12.20

### Patch Changes

- 3775d1c: Add env variables for myst whitelabeling

## 0.12.19

### Patch Changes

- 4268bce: Upgrade to mystmd 1.5.1

## 0.12.18

### Patch Changes

- 11c5933: Expose existing push options to CLI

## 0.12.17

### Patch Changes

- 83bd0c1: Allow works to be pushed to public CDN

## 0.12.16

### Patch Changes

- 6ceb5c8: Add work push to cli
- 6ceb5c8: Add site init set landing content to cli

## 0.12.15

### Patch Changes

- 2371d0c: MyST 1.3.28

## 0.12.14

## 0.12.13

## 0.12.12

### Patch Changes

- 9a02f82: Update to myst 1.3.26

## 0.12.11

## 0.12.10

## 0.12.9

### Patch Changes

- e811146: Update to mystmd 1.3.25
- 173f815: Upgrade to MyST 1.3.24

## 0.12.8

## 0.12.7

## 0.12.6

## 0.12.5

## 0.12.4

## 0.12.3

## 0.12.2

## 0.12.1

## 0.12.0

### Minor Changes

- fc08539: Overhaul of token management and sessions so that `token.aud` is honored for session token creation and `token.cfg` is used for configuration when present.

## 0.11.2

### Patch Changes

- f156729: Update to myst-cli 1.3.20

## 0.11.1

## 0.11.0

### Minor Changes

- 27d2fee: Add `cn` as an additional cli entrypoint

## 0.10.2

### Patch Changes

- 20d9914: Exit when task completes from CLI and cancel other promises
- 20d9914: Update packages

## 0.10.1

### Patch Changes

- b6fb911: bump myst

## 0.10.0

### Patch Changes

- b653945: Update to MyST 1.3.10

## 0.9.20

### Patch Changes

- 6f5cdd3: Bump MyST to v1.3.7

## 0.9.19

## 0.9.18

## 0.9.17

## 0.9.16

### Patch Changes

- 26276ff: Log waiting on long fetches
- c42d8c2: Update to myst v1.3.3

## 0.9.15

## 0.9.14

## 0.9.13

## 0.9.12

## 0.9.11

## 0.9.10

## 0.9.9

## 0.9.8

## 0.9.7

## 0.9.6

## 0.9.5

## 0.9.4

## 0.9.3

### Patch Changes

- cdca330: Upgrade Toc case to match MyST

## 0.9.2

### Patch Changes

- 51566c7: Change webp max sizes

## 0.9.1

## 0.9.0

### Minor Changes

- ca0dcfb: Deprecate export cli, change build cli to match myst

### Patch Changes

- ca0dcfb: Consume shared CLI interfaces from myst
- ca0dcfb: Remove multi-export functions
- ca0dcfb: Add --all option to token delete
- ca0dcfb: Move auth cli command under token

## 0.8.58

## 0.8.57

### Patch Changes

- f0eb01b: Add execute flag to deploy
- bbbdc17: Allow collection/kind options on check

## 0.8.56

## 0.8.55

## 0.8.54

## 0.8.53

### Patch Changes

- e86db56: Allow user to set curvenote to anonymous session

## 0.8.52

## 0.8.51

## 0.8.50

### Patch Changes

- cd48c20: Update submission to use key not transfer.yml

## 0.8.49

### Patch Changes

- abefe08: Added support for collections

## 0.8.48

### Patch Changes

- f349c3a: Enable key based [un]publishing
- 762d603: Update submission CLI for publish/unpublish

## 0.8.47

### Patch Changes

- 08be003: Add maxSize webp option to cli and default to larger value for deploy/submit

## 0.8.46

## 0.8.45

### Patch Changes

- ba71206: Bump `mystmd`

## 0.8.44

### Patch Changes

- 457f4b7: Some cli commands should skip project loading
- 47a1009: `curvenote submit` now uses the sites API for uploads, draft submissions by default go to temporary cdn, uploads will re-try 3 times, and can optionally also try to resume

## 0.8.43

### Patch Changes

- 640dd94: Add typst and cache to clean options
- 640dd94: Fix site build cli command to correct scope
- 640dd94: Add jats and meca to export/clean cli
- 640dd94: Add typst export to curvenote cli

## 0.8.42

### Patch Changes

- b18c8a3: 🔑 key based submissions, auto detect git repo and read source data
- c9c84da: Update to myst v1.1.43

## 0.8.41

### Patch Changes

- cdc6d17: Add jsdom to the dependencies

## 0.8.40

### Patch Changes

- 4ca9d5d: All submissions now create a build report. Logging same information during new, draft and updated submissions.
- 47bbf26: Simplify packaging of curvenote for faster install times
