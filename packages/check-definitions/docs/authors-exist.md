---
title: Authors Exist
---

This check ensures that there is at least one author defined. \
Ensure that the submission includes a complete list of authors with their names, affiliations, and contact information.

+++

## MyST Example

+++ { "id": "authors-exists:example:myst" }

Add an `email` to the author that you wish to be corresponding. If there is more than one author with an email,
you may mark that author specifically as `corresponding`.

```{code-block} yaml
:linenos:
:emphasize-lines: 2,3
---
authors:
  - name: Author Name
    email: author@ubc.ca
    affiliations:
      - University of British Columbia
---
```

See [MyST documentation](https://mystmd.org/guide/frontmatter#authors).

+++

## Quarto Example

+++ { "id": "authors-exists:example:quarto" }

Add an `email` to the author that you wish to be corresponding. If there is more than one author with an email,
you may mark that author specifically as `corresponding`.

```{code-block} yaml
:linenos:
:emphasize-lines: 2,3
---
authors:
  - name: Author Name
    email: author@ubc.ca
    affiliation:
      - University of British Columbia
---
```

See [Quarto documentation](https://quarto.org/docs/authoring/front-matter.html#authors-and-affiliations).
