---
title: Diagrams
description: Include simple programatic mermaid diagrams in your documents.
---

It is possible to add [mermaid diagrams](https://mermaid-js.github.io/mermaid) using the `{mermaid}` directive, for example:

````md
```{mermaid}
flowchart LR
  A[Jupyter Notebook] --> C
  B[MyST Markdown] --> C
  C(mystjs) --> D{MDAST}
  D --> E[LaTeX] --> F[PDF]
  D --> G[Word]
  D --> H[React]
  D --> I[HTML]
```
````

Will show:

```{mermaid}
flowchart LR
  A[Jupyter Notebook] --> C
  B[MyST Markdown] --> C
  C(mystjs) --> D{MDAST}
  D --> E[LaTeX] --> F[PDF]
  D --> G[Word]
  D --> H[React]
  D --> I[HTML]
```
