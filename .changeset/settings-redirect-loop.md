---
'@curvenote/scms': patch
---

Fix infinite redirect loop at `/app/settings` for users with `app:settings:read` but no sub-scopes. The `/app/settings` loader previously redirected unconditionally to `/app/settings/account`, which in turn redirected to `/app` when the user lacked `app:settings:account:read`; `/app` then redirected back to `/app/settings` via the default-route resolver. The loader now redirects to the first settings sub-page the user can actually access (using the same menu builder the secondary nav uses) and falls through to an inline "no settings available" placeholder when no sub-page is reachable.
