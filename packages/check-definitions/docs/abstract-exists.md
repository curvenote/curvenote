---
title: Abstract Exists
---

+++ { "id": "abstract-exists:overview" }

A good scientific abstract is a concise, structured summary of a research study, providing a clear understanding of the research problem, methodology, results, primary conclusions and any associated uncertainties.
It should be written in a way that engages readers and effectively communicates the essence of the study.

:::{tip} Abstract Writing Tips
:class: dropdown
Clear and Concise Language
: The abstract should use clear and straightforward language that is easy for readers to understand. Avoid jargon and complex terminology whenever possible, you should generally avoid using acronyms.

Problem Statement
: Begin with a clear and succinct description of the research problem or question. State what issue the study aims to address.

Methods
: Briefly describe the methodology used in the research, including the study design, data collection, and analysis techniques. This section should provide enough information for readers to understand the research's approach.

Results
: Summarize the most critical findings of the study. Report quantitative results and significant observations. Use specific data to support your claims.

Conclusions
: Clearly state the main conclusions or outcomes of the research. What did the study discover, and how do the results answer the research question?

Supporting Evidence
: Mention the evidence or data that support your conclusions. This could include statistical significance, trends, or other relevant findings.

Uncertainties or Limitations
: Acknowledge any limitations of the study, such as sample size, potential bias, or external factors that might impact the results. This demonstrates transparency and credibility.

Keywords
: Include relevant keywords that help other researchers find your work in databases and search engines. These keywords should reflect the core themes of your research.

No References
: Avoid citing external sources or references in the abstract. It should be self-contained and not rely on citations.

Conciseness
: Keep the abstract within the specified word limit (usually 150-250 words). Every word should contribute to the understanding of the research.

:::

+++

## MyST Example

+++ { "id": "abstract-exists:example:myst" }

To add an abstract in MyST, surround the abstract in a block `+++ {"part": "abstract"}`

```{code-block} markdown
:linenos:
:emphasize-lines: 1,5
+++ {"part": "abstract"}

We introduce, a set of open-source, community-driven ...

+++
```

See [MyST documentation](https://mystmd.org/guide/quickstart-myst-documents#add-an-abstract-block).

+++

## Quarto Example

+++ { "id": "abstract-exists:example:quarto" }

To add an abstract in Quarto, add the `abstract` key to your frontmatter in the article.
You can use the YAML syntax of `: |` to write your abstract over multiple lines.

```{code-block} yaml
:linenos:
:emphasize-lines: 2,3,4
---
abstract: |
  We introduce, a set of open-source,
  community-driven ...
---
```

See [Quarto documentation](https://quarto.org/docs/authoring/front-matter.html#abstract).

+++

## LaTeX Example

+++ { "id": "abstract-exists:example:latex" }

To add an abstract in LaTeX, use the `\begin{abstract}` block in the body of your document.

```{code-block} latex
:linenos:
:emphasize-lines: 1,3
\begin{abstract}
  We introduce, a set of open-source, community-driven ...
\end{abstract}
```
