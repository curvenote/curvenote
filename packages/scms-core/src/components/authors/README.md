# Authors & Affiliations Field

`AuthorField` is a shared React Router form component for structured author and affiliation capture.

## Route Action Contract

The host route action must handle these `intent` values:

- `search-orcid`: accepts `q`, returns `{ results: OrcidSearchHit[] }`.
- `search-orcid-by-id`: accepts `orcid`, returns `{ results: OrcidSearchHit[] }`.
- `fetch-orcid`: accepts `orcid`, returns `{ name, orcid, email?, affiliations? }`.
- `search-ror`: accepts `q`, returns `{ results: RorSearchHit[] }`.
- `save-fields`: accepts `payload` as JSON object of field updates and optional `objectId`, returns `{ objectId? }`.

The ORCID and ROR handlers are available from `@curvenote/scms-server`.

## SCMS Upload Route Follow-Up

The SCMS upload route can replace its flat textarea `AuthorsForm` with `AuthorField` by:

1. Adding the same ORCID/ROR/search/save intents to `platform/scms/app/routes/app/works.$workId.upload.$workVersionId/route.tsx`.
2. Hydrating `Author[]` and `Affiliation[]` from `workVersion.metadata['frontmatter.myst']`.
3. Persisting structured `authors` and `affiliations` back to `metadata['frontmatter.myst']`, while continuing to derive the legacy `workVersion.authors` string array from author names for existing listings.
