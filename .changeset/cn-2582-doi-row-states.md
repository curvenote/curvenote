---
'@curvenote/scms-sites-ext': minor
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
---

Show each step of a DOI registration in the submission DOI row: sending, waiting for Crossref,
registered (with Crossref's warning, if any), or unsuccessful with a readable reason and Retry. The
row refreshes itself while Crossref works, and the timeline shows the result with the same reason.
A DOI registered on the submission now wins over the work's DOI in the site submissions list and on
the work's submission page. The failed activity reads "DOI registration unsuccessful" (CN-2582).
