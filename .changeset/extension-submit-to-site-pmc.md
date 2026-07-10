---
'@curvenote/scms-core': minor
'@curvenote/scms': minor
'@hhmi/pmc': minor
---

Add extension-owned submit-to-site delegation. Extensions may declare operated sites and an optional `submitToSite` handler; core routes by declaration (delegate or fail, no fallback). PMC uses the hook to create a submission version on the current finalized work version and redirect to deposit intake without cloning a work version.
