# curvenote

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
