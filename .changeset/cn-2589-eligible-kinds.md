---
'@curvenote/scms-sites-ext': minor
'@curvenote/scms-core': minor
---

Choose which Submission Kinds can register DOIs, and as what: Site > DOI Registration gains an
Eligible Submission Kinds card (Preprint for now) and a read-only Versioning policy card. Register
and Retry refuse submissions of a kind that is not eligible, and every existing kind starts not
eligible, so a site admin enables a kind before its submissions can register. Adds
`SubmissionKind.doi_content_type`, `DoiRegistration.content_type` (backfilled to `PREPRINT`), and
`DOI_CONTENT_TYPE` / `isDoiContentType` in scms-core (CN-2589).
