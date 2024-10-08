---
title: ORCID
---

All authors are strongly encouraged to have an ORCID (Open Researcher and Contributor ID) for accurate and unique author identification. If you do not have one, please consider [registering for an ORCID](https://orcid.org/) and providing it during the submission process.

+++

## MyST Example

+++ { "id": "authors-have-orcid:example:myst" }

Add an ORCID for each author, it will be validated before publication.

```{code-block} yaml
:linenos:
:emphasize-lines: 4,6
---
authors:
  - name: Your Author Name
    orcid: 0000-0000-0000-0000
  - name: Second Author
    orcid: 0000-0000-0000-0000
---
```

See [MyST documentation](https://mystmd.org/guide/frontmatter#authors).

+++

## Quarto Example

+++ { "id": "authors-have-orcid:example:quarto" }

Add an ORCID for each author, it will be validated before publication.

```{code-block} yaml
:linenos:
:emphasize-lines: 4,6
---
author:
  - name: Your Author Name
    orcid: 0000-0000-0000-0000
  - name: Second Author
    orcid: 0000-0000-0000-0000
---
```

See [Quarto documentation](https://quarto.org/docs/authoring/front-matter.html#author).
