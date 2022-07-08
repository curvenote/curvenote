# `curvenote`

[![curvenote on npm](https://img.shields.io/npm/v/curvenote.svg)](https://www.npmjs.com/package/curvenote)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/curvenote/curvenote/blob/main/LICENSE)
![CI](https://github.com/curvenote/curvenote/workflows/CI/badge.svg)

Create, edit, share and publish scientific documents.

## Overview

`curvenote` is an open source library and command line interface (CLI) to create share and publish technical documents.

- Write papers and reports in Markdown and Jupyter ([docs](https://curvenote.com/docs/cli))
- Create and share interactive websites ([docs](https://curvenote.com/docs/web))
- Export to Word, LaTeX, and PDF with any [template](https://github.com/curvenote/templates) ([docs](https://curvenote.com/docs/export))

In addition to being completely local, `curvenote` can optionally sync content to <https://curvenote.com> to allow you to work with collaborators who enjoy WYSIWYG editing, commenting & real time collaboration for technical documents.

## Get Started

Curvenote is available through Node and NPM. Unless you already have this on your system you will have to [install NodeJS](https://curvenote.com/docs/cli/installing-prerequisites). See [full install instructions](https://curvenote.com/docs/cli/installing) in the docs!

```bash
npm install -g curvenote
curvenote init
curvenote start
curvenote deploy
```

[![](images/cli-init.png)](https://curvenote.com/docs/web)

## Built with Curvenote

Curvenote allows you to easily create, edit, and publish content to the web as a fast, optimized site with interactive citations, cross-referencing, math, and dynamic figures from Jupyter Notebooks.

Curvenote can be used to create all sorts of open-access content, click the links below to see some examples!

- [Courses](https://geosci-inversion.curve.space/inversion) & [books](https://climasoma.curve.space/)
- [Seminar](https://seminars.simpeg.xyz/) & [conference](https://transform.softwareunderground.org/) websites
- [Blogs](https://curvenote.com/blog) & [technical websites](https://www.stevejpurves.com/blog)
- [Papers](https://www.stevejpurves.com/la-palma-earthquakes) & [reports](https://www.stevejpurves.com/computational-finance)
- [Documentation](http://curvenote.com/docs)
- [Sharing Jupyter Notebooks](https://jarmitage.curve.space/)

### Interactive and Linked

The default website you create can have interactive Jupyter Notebook features, and live-preview of cross-references and citations.

[PhD Thesis](https://phd.row1.ca/) with linked references, equations, and export to PDF.
[![](images/phd-simple.gif)](https://phd.row1.ca/)

[Interactive Papers](https://www.stevejpurves.com/la-palma-earthquakes/interactive-timelines-altair) with Jupyter Notebooks and interactive visualizations.
[![](images/web-interactive.gif)](https://www.stevejpurves.com/la-palma-earthquakes/interactive-timelines-altair)

These interactive scientific sites can be easily deployed on a hosting service called [curve.space](https://curve.space) or can also be hosted on your own custom domain.

## Work locally with Live Reload

The client library is entirely local, and rebuilds in ~50ms for most projects. Meaning you can preview your content as you are writing!

[![](images/live-reload.gif)](https://www.stevejpurves.com/la-palma-earthquakes/interactive-timelines-altair)

## Direct export from Curvenote

First login, see [authorization docs](https://curvenote.com/docs/cli/authorization) to get an API token.

```bash
curvenote token set
> YOUR_API_TOKEN
```

Then you can directly export your curvenote documents to:

- Microsoft Word (.docx)
- Markdown (.md) - using MyST
- LaTeX (.tex)
- PDF (.pdf)

```bash
curvenote export docx https://curvenote.com/@curvenote/blog/communicating-science communicating-science.docx
curvenote export md https://curvenote.com/@curvenote/blog/version-control-for-scientists version-control.md
curvenote export tex https://curvenote.com/@curvenote/blog/version-control-for-scientists version-control.tex -template plain_latex
curvenote export pdf https://curvenote.com/@curvenote/blog/version-control-for-scientists version-control.pdf -template arxiv_nips
```

## LaTeX and PDF Dependencies

Exporting to:

- LaTeX (`latex`|`tex`) with a template option specified
- or to PDF

Requires the [jtex](https://pypi.org/project/jtex/) python package to be installed and available on the user's `PATH`.

With python 3.7 or greater installed, install `jtex` via pip:

```bash
python -m pip install jtex
```

# Development

All dependencies for `curvenote` are included in this repository (a monorepo!).

## What's inside?

`curvenote` uses [npm](https://www.npmjs.com/) as a package manager. It includes the following packages/apps:

**Apps:**

- `curvenote`: the Curvenote command line interface (CLI)
- `curvespace`: the web-experience for Curvenote sites, using Remix

**Packages:**

- `ui-providers`: React providers for references and site configuration
- `myst-util-to-react`: expose MyST content as an article, built with React
- `site`: components and utilities for building React and Remix sites
- `site-common`: utilities and types that are used in the CLI, APIs and sites, does not include React
- `icons`: icons used throughout our projects, built for React
- `eslint-config-custom`: `eslint` configurations
- `tsconfig`: `tsconfig.json`s used throughout the monorepo

Each package and app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

`curvenote` is built and developed using:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd curvenote
npm run build
```

### Develop

To develop all apps and packages, run the following command:

```
cd curvenote
npm run dev
```
