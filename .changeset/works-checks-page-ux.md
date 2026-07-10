---
'@curvenote/scms-core': patch
'@curvenote/scms': patch
---

Improve the work checks page. Show `v{n}` version badges on timeline headers, latest-run card footers, and the Check Latest Version button; order check sections alphabetically by extension name; compute the latest version number in the loader so the CTA no longer falls back to `v0`; and tighten activity card padding. Add `sortExtensionCheckServicesByExtensionName` in core for stable section ordering.
