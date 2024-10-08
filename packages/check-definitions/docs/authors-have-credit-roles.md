---
title: CRediT Roles
---

All authors are strongly encouraged to include their contributions as [CRediT Roles](https://credit.niso.org).
There are 14 official contributor roles that are in the NISO CRediT Role standard.

:::{note} CRediT Roles
:class: dropdown

There are 14 official contributor roles that are in the NISO CRediT Role standard.
In addition to British english, incorrect case or punctuation, there are also a number of aliases that can be used for various roles.

| Official CRediT Role                                                                            | Alias               |
| ----------------------------------------------------------------------------------------------- | ------------------- |
| [Conceptualization](https://credit.niso.org/contributor-roles/conceptualization/)               | `conceptualisation` |
| [Data curation](https://credit.niso.org/contributor-roles/data-curation/)                       |                     |
| [Formal analysis](https://credit.niso.org/contributor-roles/formal-analysis/)                   | `analysis`          |
| [Funding acquisition](https://credit.niso.org/contributor-roles/funding-acquisition/)           |                     |
| [Investigation](https://credit.niso.org/contributor-roles/investigation/)                       |                     |
| [Methodology](https://credit.niso.org/contributor-roles/methodology/)                           |                     |
| [Project administration](https://credit.niso.org/contributor-roles/project-administration/)     | `administration`    |
| [Resources](https://credit.niso.org/contributor-roles/resources/)                               |                     |
| [Software](https://credit.niso.org/contributor-roles/software/)                                 |                     |
| [Supervision](https://credit.niso.org/contributor-roles/supervision/)                           |                     |
| [Validation](https://credit.niso.org/contributor-roles/validation/)                             |                     |
| [Visualization](https://credit.niso.org/contributor-roles/visualization/)                       | `visualisation`     |
| [Writing – original draft](https://credit.niso.org/contributor-roles/writing-original-draft/)   | `writing`           |
| [Writing – review & editing](https://credit.niso.org/contributor-roles/writing-review-editing/) | `editing`, `review` |

:::

+++

## MyST Example

+++ { "id": "authors-have-credit-roles:example:myst" }

Add contribution roles for each author, these should be valid CRediT Roles.

```{code-block} yaml
:linenos:
:emphasize-lines: 4,5,6,7
---
authors:
  - name: Penny Crediton
    roles:
      - Conceptualization
      - Data curation
      - Validation
---
```

See [MyST documentation](https://mystmd.org/guide/frontmatter#authors).

+++

## Quarto Example

+++ { "id": "authors-have-credit-roles:example:quarto" }

Add an ORCID for each author, it will be validated before publication.

```{code-block} yaml
:linenos:
:emphasize-lines: 4,5,6,7
---
authors:
  - name: Penny Crediton
    roles:
      - Conceptualization
      - Data curation
      - Validation
---
```

See [Quarto documentation](https://quarto.org/docs/authoring/front-matter.html#author).
