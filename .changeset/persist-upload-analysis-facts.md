---
'@curvenote/scms': patch
---

Persist upload analysis facts during manuscript preview and metadata extraction. Record image presence from document previews and title/author/affiliation presence from extracted frontmatter under `metadata.upload.analysis`, keyed by a manuscript source signature. Wire the derived eligibility context into upload check cards so extensions can enable or disable checks based on confident upload facts.
