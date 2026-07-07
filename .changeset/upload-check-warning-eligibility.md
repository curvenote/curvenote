---
'@curvenote/scms-core': patch
---

Add upload check warning eligibility state. Extensions can return `eligible`, `warning`, or `ineligible` from `resolveUploadEligibility`; the platform renders warning cards with amber chrome and advisory messages without blocking submission.
