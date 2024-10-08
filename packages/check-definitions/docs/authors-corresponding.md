---
title: Corresponding Author
---

+++ { "id": "authors-corresponding:overview" }

Include an `email` for at least one author.
Feel free to also include other details of the corresponding author(s), including their affiliation, and other contact information (phone, fax, etc) if available.

+++

## MyST Example

+++ { "id": "authors-corresponding:example:myst" }

Add an `email` to the author that you wish to be corresponding. If there is more than one author with an email,
you may mark that author specifically as `corresponding`.

```{code-block} yaml
:linenos:
:emphasize-lines: 4,5
---
authors:
  - name: Your Author Name
    email: author@university.edu
    corresponding: true
---
```

See [MyST documentation](https://mystmd.org/guide/frontmatter#authors).

+++

## Quarto Example

+++ { "id": "authors-corresponding:example:quarto" }

Add an `email` to the author that you wish to be corresponding. If there is more than one author with an email,
you may mark that author specifically as `corresponding`.

```{code-block} yaml
:linenos:
:emphasize-lines: 4,5
---
author:
  - name: Your Author Name
    email: author@university.edu
    corresponding: true
---
```

See [Quarto documentation](https://quarto.org/docs/authoring/front-matter.html#author).
