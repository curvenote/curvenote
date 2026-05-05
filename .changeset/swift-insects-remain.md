---
'@curvenote/cli': patch
---

Fix fatal crash during checks when a `card` directive has no url field, when url is missing the card is no longer treated as a link.
