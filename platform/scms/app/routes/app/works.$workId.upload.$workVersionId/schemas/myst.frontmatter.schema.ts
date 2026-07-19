const MYST_FRONTMATTER_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'MyST Markdown Frontmatter Schema',
  description:
    'Schema for MyST Markdown frontmatter fields, valid for both page and project configuration.',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      maxLength: 500,
      description: 'Primary title of the project or page.',
    },
    subtitle: {
      type: 'string',
      maxLength: 500,
      description: 'Subtitle of the project or page.',
    },
    short_title: {
      type: 'string',
      maxLength: 40,
      description: 'Short title for limited space contexts.',
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Description of the project or page.',
    },
    exports: {
      type: 'object',
      description: 'Export configuration for static versions of documents.',
      properties: {
        id: { type: 'string', description: 'Local identifier for the export.' },
        format: {
          type: 'string',
          enum: ['pdf', 'tex', 'pdf+tex', 'typst', 'docx', 'md', 'jats', 'meca'],
          description: 'Export format.',
        },
        template: {
          type: 'string',
          description: 'Name of an existing MyST template or local path.',
        },
        output: { type: 'string', description: 'Export output filename or destination folder.' },
        zip: { type: 'boolean', description: 'If true, zip the output.' },
        articles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Path(s) to articles to include in the export.',
        },
        toc: { type: 'string', description: 'Path to jupyterbook _toc.yml file.' },
        sub_articles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Path(s) to sub-articles for JATS export.',
        },
      },
      required: ['format'],
    },
    downloads: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Reference to an existing export identifier.' },
          file: { type: 'string', description: 'Path to a local file.' },
          url: {
            type: 'string',
            description: 'Full or relative URL of a page or downloadable file.',
          },
          title: { type: 'string', description: 'Title of the download entry.' },
          filename: { type: 'string', description: 'Name of the file upon download.' },
          static: { type: 'boolean', description: 'If true, treat as a static file.' },
        },
        oneOf: [{ required: ['id'] }, { required: ['file'] }, { required: ['url'] }],
      },
    },
    label: {
      type: 'string',
      maxLength: 500,
      description: 'Identifier for the page in cross-references (page only).',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of strings to categorize content.',
    },
    thumbnail: {
      type: 'string',
      description: 'Link to a local or remote image for previews.',
    },
    banner: {
      type: 'string',
      description: 'Link to a local or remote image for banners.',
    },
    parts: {
      type: 'object',
      description: 'Dictionary of arbitrary content parts, e.g., abstract, data_availability.',
    },
    bibliography: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of file paths to bibliography files (project only).',
    },
    date: {
      type: 'string',
      description: 'Valid date formatted string.',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of strings to highlight key concepts.',
    },
    authors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: ['string', 'object'],
            description: 'Author’s full name or CSL-JSON author object.',
          },
          id: { type: 'string', description: 'Local identifier for the author.' },
          orcid: { type: 'string', description: 'Valid ORCID identifier.' },
          corresponding: { type: 'boolean', description: 'If true, author is corresponding.' },
          email: {
            type: 'string',
            description: 'Email of the author (required if corresponding).',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of valid CRediT Contributor Roles.',
          },
          affiliations: {
            type: 'array',
            items: { type: ['string', 'object'] },
            description: 'List of affiliation identifiers or objects.',
          },
          equal_contributor: {
            type: 'boolean',
            description: 'If true, author is an equal contributor.',
          },
          deceased: { type: 'boolean', description: 'If true, author is deceased.' },
          note: { type: 'string', description: 'Additional information about the author.' },
          phone: { type: 'string', description: 'Phone number of the author.' },
          fax: { type: 'string', description: 'Fax number of the author.' },
          url: { type: 'string', description: 'Website or homepage of the author.' },
          bluesky: { type: 'string', description: 'Bluesky username or URL.' },
          mastodon: { type: 'string', description: 'Mastodon webfinger account.' },
          threads: { type: 'string', description: 'Threads/Instagram username.' },
          linkedin: { type: 'string', description: 'LinkedIn URL.' },
          twitter: { type: 'string', description: 'Twitter/X username or URL.' },
          facebook: { type: 'string', description: 'Facebook URL.' },
          discord: { type: 'string', description: 'Discord URL.' },
          youtube: { type: 'string', description: 'YouTube handle or URL.' },
          discourse: { type: 'string', description: 'Discourse URL.' },
          slack: { type: 'string', description: 'Slack URL.' },
          github: {
            type: 'string',
            description: 'GitHub username, repository, or organization URL.',
          },
        },
        required: ['name'],
      },
    },
    reviewers: {
      type: 'array',
      items: { type: ['string', 'object'] },
      description: 'List of reviewer objects or string ids.',
    },
    editors: {
      type: 'array',
      items: { type: ['string', 'object'] },
      description: 'List of editor objects or string ids.',
    },
    affiliations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Local identifier for the affiliation.' },
          name: { type: 'string', description: 'Name of the affiliation.' },
          institution: { type: 'string', description: 'Name of the institution or organization.' },
          department: { type: 'string', description: 'Department of the affiliation.' },
          doi: { type: 'string', description: 'DOI of the affiliation.' },
          ror: { type: 'string', description: 'ROR identifier of the affiliation.' },
          isni: { type: 'string', description: 'ISNI identifier of the affiliation.' },
          ringgold: { type: 'string', description: 'Ringgold identifier of the affiliation.' },
          email: { type: 'string', description: 'Email of the affiliation.' },
          address: { type: 'string', description: 'Address of the affiliation.' },
          city: { type: 'string', description: 'City of the affiliation.' },
          state: { type: 'string', description: 'State/Province/Region of the affiliation.' },
          postal_code: { type: 'string', description: 'Postal code of the affiliation.' },
          country: { type: 'string', description: 'Country of the affiliation.' },
          url: { type: 'string', description: 'Website of the affiliation.' },
          github: {
            type: 'string',
            description: 'GitHub username, repository, or organization URL.',
          },
          collaboration: {
            type: 'boolean',
            description: 'If true, affiliation is a collaboration.',
          },
        },
        required: ['name'],
      },
    },
    doi: { type: 'string', description: 'Valid DOI, either URL or id.' },
    arxiv: { type: 'string', description: 'Valid arXiv reference, either URL or id.' },
    pmid: { type: 'integer', description: 'Valid PubMed ID.' },
    pmcid: {
      type: 'string',
      description: 'Valid PubMed Central ID, a string ‘PMC’ followed by numeric digits.',
    },
    open_access: { type: 'boolean', description: 'If true, content is open access.' },
    license: {
      type: ['string', 'object'],
      description: 'License object or string (SPDX identifier).',
      properties: {
        content: { type: ['string', 'object'], description: 'License for content.' },
        code: { type: ['string', 'object'], description: 'License for code.' },
      },
    },
    copyright: { type: 'string', description: 'Copyright statement.' },
    funding: {
      type: ['string', 'object', 'array'],
      description: 'Funding statement or object with award info.',
    },
    github: { type: 'string', description: 'Valid GitHub URL or owner/reponame.' },
    edit_url: { type: 'string', description: 'URL to edit the page source.' },
    source_url: { type: 'string', description: 'URL to view the page source.' },
    binder: { type: 'string', description: 'Valid URL for Binder.' },
    subject: { type: 'string', maxLength: 40, description: 'Subject of the project or page.' },
    venue: {
      type: 'object',
      description: 'Venue object with journal and conference metadata.',
      properties: {
        title: { type: 'string', description: 'Full title of the venue.' },
        short_title: { type: 'string', description: 'Short title of the venue.' },
        url: { type: 'string', description: 'URL of the venue.' },
        doi: { type: 'string', description: 'DOI of the venue.' },
        number: { type: 'string', description: 'Number of the venue in a series.' },
        location: { type: 'string', description: 'Physical location of a conference.' },
        date: { type: 'string', description: 'Date associated with the venue.' },
        series: {
          type: 'string',
          description: 'Title of a series that this venue or work is part of.',
        },
        issn: { type: 'string', description: 'ISSN for the publication.' },
        publisher: { type: 'string', description: 'Publisher of the journal.' },
      },
    },
    volume: {
      type: 'object',
      description: 'Information about the journal volume.',
      properties: {
        number: { type: ['string', 'number'], description: 'Identifier for journal volume.' },
        title: { type: 'string', description: 'Title of the volume.' },
        subject: { type: 'string', description: 'Description of the subject of the volume.' },
        doi: { type: 'string', description: 'DOI of the volume.' },
      },
    },
    issue: {
      type: 'object',
      description: 'Information about the journal issue.',
      properties: {
        number: { type: ['string', 'number'], description: 'Identifier for journal issue.' },
        title: { type: 'string', description: 'Title of the issue.' },
        subject: { type: 'string', description: 'Description of the subject of the issue.' },
        doi: { type: 'string', description: 'DOI of the issue.' },
      },
    },
    first_page: {
      type: ['string', 'number'],
      description: 'First page of the project or article.',
    },
    last_page: { type: ['string', 'number'], description: 'Last page of the project or article.' },
    math: {
      type: 'object',
      description: 'Dictionary of math macros.',
    },
    abbreviations: {
      type: 'object',
      description: 'Dictionary of abbreviations in the project.',
    },
    numbering: {
      type: 'object',
      description: 'Object for customizing content numbering.',
    },
    options: {
      type: 'object',
      description: 'Dictionary of arbitrary options for templates.',
    },
    id: { type: 'string', description: 'Unique identifier for the project (project only).' },
    references: {
      type: 'object',
      description: 'Configuration for intersphinx references (project only).',
    },
    requirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Files required for reproducing the executional environment (project only).',
    },
    resources: {
      type: 'array',
      items: { type: 'string' },
      description: 'Other resources associated with your project (project only).',
    },
    social: {
      type: 'object',
      description: 'Social links (project only).',
    },
    jupyter: {
      type: 'object',
      description: 'Configuration for Jupyter execution (project only).',
    },
    thebe: {
      type: 'object',
      description: 'Configuration for Thebe execution (project only).',
    },
    kernelspec: {
      type: 'object',
      description: 'Configuration for the kernel (page only).',
    },
    execute: {
      type: 'object',
      description: 'Configuration for build-time execution of a document (page only).',
    },
  },
  additionalProperties: false,
};
