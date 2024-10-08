import { TemplateOptionType } from 'myst-common';
import type { CheckDefinition } from './types.js';
import { CheckTags } from './types.js';

export const submissionRuleChecks: CheckDefinition[] = [
  {
    id: 'abstract-exists',
    title: 'Abstract Exists',
    purpose: 'ensure abstract exists',
    tags: [CheckTags.frontmatter, CheckTags.abstract],
  },
  {
    id: 'abstract-length',
    title: 'Abstract Length',
    purpose: 'ensure abstract has the correct length',
    tags: [CheckTags.frontmatter, CheckTags.abstract],
    options: [
      {
        id: 'max',
        title: 'Maximum word count for abstract',
        type: TemplateOptionType.number,
        default: 400,
      },
    ],
  },
  {
    id: 'authors-exist',
    title: 'Authors',
    purpose: 'ensure authors are defined',
    tags: [CheckTags.frontmatter, CheckTags.authors],
  },
  {
    id: 'authors-corresponding',
    title: 'Corresponding Author',
    purpose: 'ensure there is a corresponding author',
    tags: [CheckTags.frontmatter, CheckTags.authors],
  },
  {
    id: 'authors-have-affiliations',
    title: 'Author Affiliations',
    purpose: 'ensure each author has an affiliation',
    tags: [CheckTags.frontmatter, CheckTags.authors],
  },
  {
    id: 'authors-have-orcid',
    title: 'ORCID',
    purpose: 'ensure each author has an ORCID',
    tags: [CheckTags.frontmatter, CheckTags.authors],
  },
  {
    id: 'authors-have-credit-roles',
    title: 'CRediT Roles',
    purpose: 'ensure each author has one or more CRediT roles',
    tags: [CheckTags.frontmatter, CheckTags.authors],
  },
  {
    id: 'data-availability-exists',
    title: 'Data Availability Statement',
    purpose: 'ensure data availability statement exists',
    tags: [CheckTags.frontmatter, CheckTags.dataAvailability],
  },
  {
    id: 'keywords-defined',
    title: 'Keywords',
    purpose: 'ensure keywords exist',
    tags: [CheckTags.frontmatter, CheckTags.keywords],
  },
  {
    id: 'keywords-length',
    title: 'Number of Keywords',
    purpose: 'ensure the right number of keywords exist',
    options: [
      {
        id: 'max',
        title: 'Maximum number of keywords',
        type: TemplateOptionType.number,
        default: 5,
      },
    ],
    tags: [CheckTags.frontmatter, CheckTags.keywords],
  },
  {
    id: 'keywords-unique',
    title: 'Unique Keywords',
    purpose: 'ensure the keywords are unique',
    tags: [CheckTags.frontmatter, CheckTags.keywords],
  },
  {
    id: 'links-resolve',
    title: 'Links Resolve',
    purpose: 'ensure all external URLs resolve',
    tags: [CheckTags.content, CheckTags.link],
  },
  {
    id: 'doi-exists',
    title: 'DOI Exists',
    purpose: 'ensure all citations have valid DOI',
    options: [
      {
        id: 'fix',
        type: TemplateOptionType.boolean,
        title: 'Fix DOIs',
        description: 'Propose alternatives for missing/invalid DOIs',
      },
    ],
    tags: [CheckTags.content, CheckTags.citation],
  },
  {
    id: 'word-count',
    title: 'Word Count',
    purpose: 'ensure the document word count is acceptable',
    options: [
      {
        id: 'max',
        type: TemplateOptionType.number,
        integer: true,
        min: 0,
        description: 'Maximum number of words allowed',
        default: 3500,
      },
      {
        id: 'min',
        type: TemplateOptionType.number,
        integer: true,
        min: 0,
        description: 'Minimum number of words required',
        default: 0,
      },
      {
        id: 'figures',
        type: TemplateOptionType.boolean,
        description: 'Include figure/table contents and captions in word count',
        default: false,
      },
      {
        id: 'footnotes',
        type: TemplateOptionType.boolean,
        description: 'Include footnotes in word count',
        default: false,
      },
      {
        id: 'part',
        type: TemplateOptionType.string,
        description:
          'Part of document to count; if not provided, main body content will be counted',
        required: false,
      },
    ],
    tags: [CheckTags.content],
  },
  {
    id: 'figure-count',
    title: 'Figure Count',
    purpose: 'ensure the document figure/table/etc count is acceptable',
    options: [
      {
        id: 'max',
        type: TemplateOptionType.number,
        integer: true,
        min: 0,
        description: 'Maximum number of figures/tables/etc allowed',
        default: 100,
      },
      {
        id: 'min',
        type: TemplateOptionType.number,
        integer: true,
        min: 0,
        description: 'Minimum number of figures/tables/etc required',
        default: 0,
      },
      {
        id: 'kind',
        type: TemplateOptionType.string,
        description:
          'Specific figure kind to count, e.g. figure (for only counting explicit "Figures"), table, code',
        required: false,
      },
    ],
    tags: [CheckTags.content],
  },
];
