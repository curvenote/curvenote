---
'@curvenote/scms': patch
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
---

Improve work user access controls and scope consistency. Rename the work users read scope to `work:users:read`, grant viewers read access to the work users list, and gate the "Who can access this?" menu item on that scope. On the work users page, show role removal controls and the add-user form only for owners (or system admins); contributors and viewers can still read the list to identify owners.
