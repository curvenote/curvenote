---
'@curvenote/scms-core': patch
'@curvenote/scms': patch
---

Fix page width containment regression in `MainWrapper`. Restores flex-child width clamping by adding `min-w-0`, so wide descendant content no longer overflows the main column and blows out the layout when the primary and secondary navs are shown. This preserves the previous behaviour without reintroducing `overflow-hidden`, keeping sticky/overflowing children visible.
