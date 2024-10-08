---
title: Word Count
---

+++ { "id": "word-count:overview" }

Manuscript word count (or manuscript _part_ word count, e.g. abstract) must fit within the specified limit. This limit excludes citations and ignores comments. It also usually excludes figures and footnotes.

+++ { "id": "word-count:options" }

If the word-count check includes a `part`, only that part of the manuscript will be counted. If a `part` is not specified, a few common sections will be excluded from the count (abstract, summary, acknowledgments, data availability, key points, etc.).

```{tip}
The [`abstract-length` check](./abstract-length.md) is equivalent to `word-count` check with `part: abstract`.
```

The check also has options for `figure` and `footnote` counting; by default, words in those will not be counted, but if `true`, they will be counted (in addition to the rest of the manuscript). For counting only figures, see [](./figure-count.md).

