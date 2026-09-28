---
'@curvenote/scms-sites-ext': patch
'@curvenote/scms-core': patch
---

Show the publication date in the Register DOI dialog as the calendar day sent to Crossref. It was
formatted from a UTC timestamp in the browser's timezone, so users west of UTC saw the day before.
Publication dates stored with a time now show their UTC day everywhere (submission details,
listing, DOI dialog), matching the deposit. Add `utcDayFromDate` to `@curvenote/scms-core` for the
UTC calendar day of a `Date`.
