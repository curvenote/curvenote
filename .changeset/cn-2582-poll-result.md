---
'@curvenote/scms-sites-ext': minor
---

Follow a DOI deposit up with Crossref: a `CROSSREF_POLL` job reads the deposit's result, rescheduling
itself until Crossref has processed it (72 hours at most), and settles the registration. On success
it sets `Submission.doi`, so the DOI resolves through the platform lookup; on failure it keeps
Crossref's message on the deposit (CN-2582).
