---
'@curvenote/scms-server': patch
'@curvenote/scms-core': patch
---

Fix malformed `/app//<path>` URLs when navigation item paths are configured with a leading slash. `resolveAccessibleDefaultRoute` now returns nav paths without leading or trailing slashes so the `/app` landing loader can safely concatenate `'/app/' + target`, and `PrimaryNav` normalizes the path the same way when building `NavLink` destinations, so redirects and rendered nav links stay in sync.
