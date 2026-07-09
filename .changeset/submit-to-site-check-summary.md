---
'@curvenote/scms': patch
---

Improve the submit-to-site popover check review panel. Surface the latest run of each check kind on the selected version and any older versions (not newer ones), show a `v{n}` badge when that run came from a different version, use `VersionTagBadge` in the version picker, truncate long status labels with a tooltip while keeping the left column width fixed, and style the send trigger as a ghost button with a primary icon.
