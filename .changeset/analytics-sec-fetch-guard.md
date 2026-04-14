---
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Suppress server `Context.trackEvent` for browser GET/HEAD data loads (`Sec-Fetch-Dest: empty`), including React Router single-fetch revalidation and polling-style fetches. Add `EventOptions.forceTrackPolls` to opt back in. Rely on the shared guard from the work layout loader instead of a route-local check.
