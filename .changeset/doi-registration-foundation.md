---
'@curvenote/scms-core': minor
'@curvenote/scms-server': minor
'@curvenote/scms-sites-ext': minor
---

Add the DOI registration foundation: `DoiRegistration`, `DoiDeposit` and `Submission.doi`,
registration statuses and Crossref job types, a Crossref deposit and result client in the sites
extension, DOI resolution through `Submission.doi` before work DOIs (also shown as the DOI in the
site-work DTO), and a guard that keeps a Site's DOI setup from being unlinked or reset while it has
registered DOIs.
