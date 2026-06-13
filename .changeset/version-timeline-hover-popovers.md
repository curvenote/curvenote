---
'@curvenote/scms-core': minor
'@curvenote/scms': minor
'@curvenote/scms-sites-ext': minor
---

Add version timeline hover popovers on works and submissions listings.

- **Works listing** — a Timeline control opens a lazy-loaded work-version timeline with created/modified dates, work version tags, and compact site chips for linked submission versions (status ring + inline tag).
- **Submissions listing** — status badges, version tags, and published/retracted chips open the submission-version timeline (publication date, tag, status, activity line).
- **Shared `@curvenote/scms-core` UI** — `VersionTimelineHoverCard`, row renderers, client cache/revalidate hook, and JSON URL helpers reused by both surfaces.
- **Trimmed API payloads** — `/app/works/:workId/versions` and `/app/sites/:siteName/submissions/:submissionId/versions` return at most eight visible entries plus dashed gap markers when versions are omitted; a footer link opens the full timeline on the work details or submission detail page.
- **Selection rules** — submission timelines prioritise published versions and the first significant (oldest published, else inaugural) version; work timelines always show the first work version and prefer versions with submission versions, then published submission versions.
