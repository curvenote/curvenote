---
title: Citations and bibliography
description: Add academic citations to your documents easily, have hover-references and an automatically created bibliography.
---

Citations automatically show up in your site, including a references section at the bottom of the page. These citations are able to be clicked on to see more information, like the abstract. There are two different ways to add citations to your documents: (1) adding a markdown link to a {wiki}`DOI <Digital object identifier>`; and (2) by adding a bibtex file, which can be exported from any reference manager, and adding a `cite` role to your content.

+++

## Simple Referencing with a DOI Link

Add citations easily to your markdown files or Jupyter Notebooks by including the citation as a link to the `doi`. For example:

```md
This is a link in markdown: [Cockett, 2022](https://doi.org/10.5281/zenodo.6476040).
```

Provided the `doi` is formatted correctly, this will be changed during the build process, to a citation with a pop-up panel on hover like this: [Cockett, 2022](https://doi.org/10.5281/zenodo.6476040), and the reference information will be automatically added to the reference section at the bottom of your notebook (see below👇).

Providing your DOIs as links has the advantage that on other rendering platforms (e.g. GitHub or in Jupyter Notebooks), your citation will still be shown as a link. If you have many citations, however, this can slow down the build process as the citation information is fetched dynamically.

+++

## Including BibTex

A standard way of including references for $\LaTeX$ is using {wiki}`bibtex`, you can include a `*.bib` file or files in the same directory as your content directory for the project. These will provide the reference keys for that project.

To create a citation in Markdown, use either a parenthetical or textual citation:

```md
This is a parenthetical citation {cite:p}`cockett2015`.
You can also use a narrative citation with {cite:t}`cockett2015`.
You can also use a narrative citation with {cite:p}`cockett2015; heagy2017`.
```

This is the difference between: {cite:p}`cockett2015` and {cite:t}`cockett2015`. You can have many citation keys in a single role, by separating them with a `;`, for example: {cite:p}`cockett2015; heagy2017`.

You can also include DOIs in citations (`cite`, `cite:t`, and `cite:p`) which will be linked in the same way as a simple markdown link, but will match the reference style of the project.

```md
This will be a citation: {cite}`10.1103/PhysRevLett.116.061102`.
```

This will show as: {cite}`10.1103/PhysRevLett.116.061102`.

## Specififying BibTeX

If you want to explicitly reference which bibtex files to use, as well as what order to resolve them in, you can use the `bibliography` field in your frontmatter, which is a string array of local or remote files. This will load the files in order specified.

```yaml
bibliography:
  - my_references.bib
  - https://example.com/my/remote/bibtex.bib
```

The remote bibtex can be helpful for working with reference managers that support remote links to your references.
