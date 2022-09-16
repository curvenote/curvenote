import { validate } from 'doi-utils';
import type { ValidationOptions } from '@curvenote/validators';
import {
  defined,
  incrementOptions,
  fillMissingKeys,
  filterKeys,
  validateBoolean,
  validateDate,
  validateEmail,
  validateEnum,
  validateKeys,
  validateList,
  validateObject,
  validateObjectKeys,
  validateString,
  validateUrl,
  validationError,
  validationWarning,
} from '@curvenote/validators';
import { validateLicenses } from '../licenses/validators';
import { CreditRoles, ExportFormats } from './types';
import type {
  Author,
  Biblio,
  Export,
  Jupytext,
  KernelSpec,
  Numbering,
  PageFrontmatter,
  ProjectFrontmatter,
  SiteFrontmatter,
  TextRepresentation,
  Venue,
} from './types';

export const SITE_FRONTMATTER_KEYS = ['title', 'description', 'venue', 'keywords'];
export const PROJECT_FRONTMATTER_KEYS = [
  'authors',
  'date',
  'name',
  'doi',
  'arxiv',
  'open_access',
  'license',
  'github',
  'binder',
  'source',
  'subject',
  'biblio',
  'oxa',
  'numbering',
  'bibliography',
  'math',
  'exports',
].concat(SITE_FRONTMATTER_KEYS);
export const PAGE_FRONTMATTER_KEYS = [
  'subtitle',
  'short_title',
  'kernelspec',
  'jupytext',
  'tags',
  'thumbnail',
  'thumbnailOptimized',
].concat(PROJECT_FRONTMATTER_KEYS);

// These keys only exist on the project.
PROJECT_FRONTMATTER_KEYS.push('references');

export const USE_SITE_FALLBACK = ['venue'];
export const USE_PROJECT_FALLBACK = [
  'authors',
  'date',
  'doi',
  'arxiv',
  'open_access',
  'license',
  'github',
  'binder',
  'source',
  'subject',
  'venue',
  'biblio',
  'numbering',
  'keywords',
  'exports',
];

const AUTHOR_KEYS = [
  'userId',
  'name',
  'orcid',
  'corresponding',
  'email',
  'roles',
  'affiliations',
  'twitter',
  'github',
  'website',
];
const BIBLIO_KEYS = ['volume', 'issue', 'first_page', 'last_page'];
const NUMBERING_KEYS = [
  'enumerator',
  'figure',
  'equation',
  'table',
  'code',
  'heading_1',
  'heading_2',
  'heading_3',
  'heading_4',
  'heading_5',
  'heading_6',
];
const KERNELSPEC_KEYS = ['name', 'language', 'display_name', 'argv', 'env'];
const TEXT_REPRESENTATION_KEYS = ['extension', 'format_name', 'format_version', 'jupytext_version'];
const JUPYTEXT_KEYS = ['formats', 'text_representation'];
export const RESERVED_EXPORT_KEYS = ['format', 'template', 'output', 'id', 'name'];

const GITHUB_USERNAME_REPO_REGEX = '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$';
const ORCID_REGEX = '^(http(s)?://orcid.org/)?([0-9]{4}-){3}[0-9]{3}[0-9X]$';

/**
 * Validate Venue object against the schema
 *
 * If 'value' is a string, venue will be coerced to object { title: value }
 */
export function validateVenue(input: any, opts: ValidationOptions) {
  let titleOpts: ValidationOptions;
  if (typeof input === 'string') {
    input = { title: input };
    titleOpts = opts;
  } else {
    // This means 'venue.title' only shows up in errors if present in original input
    titleOpts = incrementOptions('title', opts);
  }
  const value = validateObjectKeys(input, { optional: ['title', 'url'] }, opts);
  if (value === undefined) return undefined;
  const output: Venue = {};
  if (defined(value.title)) {
    output.title = validateString(value.title, titleOpts);
  }
  if (defined(value.url)) {
    output.url = validateUrl(value.url, incrementOptions('url', opts));
  }
  return output;
}

/**
 * Validate Author object against the schema
 */
export function validateAuthor(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: AUTHOR_KEYS }, opts);
  if (value === undefined) return undefined;
  const output: Author = {};
  if (defined(value.userId)) {
    // TODO: Better userId validation - length? regex?
    output.userId = validateString(value.userId, incrementOptions('userId', opts));
  }
  if (defined(value.name)) {
    output.name = validateString(value.name, incrementOptions('name', opts));
  }
  if (defined(value.orcid)) {
    output.orcid = validateString(value.orcid, {
      ...incrementOptions('orcid', opts),
      regex: ORCID_REGEX,
    });
  }
  if (defined(value.corresponding)) {
    const correspondingOpts = incrementOptions('corresponding', opts);
    output.corresponding = validateBoolean(value.corresponding, correspondingOpts);
    if (value.corresponding && !defined(value.email)) {
      validationError(`must include email for corresponding author`, correspondingOpts);
      output.corresponding = false;
    }
  }
  if (defined(value.email)) {
    output.email = validateEmail(value.email, incrementOptions('email', opts));
  }
  if (defined(value.roles)) {
    const rolesOpts = incrementOptions('roles', opts);
    output.roles = validateList(value.roles, rolesOpts, (r) => {
      const roleString = validateString(r, rolesOpts);
      if (roleString === undefined) return undefined;
      const role = validateEnum<CreditRoles>(roleString, {
        ...rolesOpts,
        suppressErrors: true,
        enum: CreditRoles,
      });
      if (!role) {
        validationWarning(
          `unknown value "${role}" - should be CRT contributor roles - see https://credit.niso.org/`,
          rolesOpts,
        );
        return roleString;
      }
      return role;
    });
  }
  if (defined(value.affiliations)) {
    const affiliationsOpts = incrementOptions('affiliations', opts);
    output.affiliations = validateList(value.affiliations, affiliationsOpts, (aff) => {
      return validateString(aff, affiliationsOpts);
    });
  }
  if (defined(value.twitter)) {
    output.twitter = validateString(value.twitter, incrementOptions('twitter', opts));
  }
  if (defined(value.github)) {
    output.github = validateString(value.github, incrementOptions('github', opts));
  }
  if (defined(value.website)) {
    output.website = validateUrl(value.website, incrementOptions('website', opts));
  }
  return output;
}

function validateStringOrNumber(input: any, opts: ValidationOptions) {
  if (typeof input === 'string') return validateString(input, opts);
  if (typeof input === 'number') return input;
  return validationError('must be string or number', opts);
}

function validateBibliography(input: any, opts: ValidationOptions) {
  if (typeof input === 'string') {
    const value = validateString(input, opts);
    if (value) return [value];
    return undefined;
  }
  if (!Array.isArray(input)) {
    return validationError('must be string or a list of strings', opts);
  }
  return validateList(input, opts, (r) => {
    const role = validateString(r, opts);
    if (role === undefined) return undefined;
    return role;
  });
}

/**
 * Validate Biblio object
 *
 * https://docs.openalex.org/about-the-data/work#biblio
 */
export function validateBiblio(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: BIBLIO_KEYS }, opts);
  if (value === undefined) return undefined;
  const output: Biblio = {};
  if (defined(value.volume)) {
    output.volume = validateStringOrNumber(value.volume, incrementOptions('volume', opts));
  }
  if (defined(value.issue)) {
    output.issue = validateStringOrNumber(value.issue, incrementOptions('issue', opts));
  }
  if (defined(value.first_page)) {
    output.first_page = validateStringOrNumber(
      value.first_page,
      incrementOptions('first_page', opts),
    );
  }
  if (defined(value.last_page)) {
    output.last_page = validateStringOrNumber(value.last_page, incrementOptions('last_page', opts));
  }
  return output;
}

/**
 * Validate Numbering object
 */
export function validateNumbering(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: NUMBERING_KEYS }, opts);
  if (value === undefined) return undefined;
  const output: Record<string, any> = {};
  if (defined(value.enumerator)) {
    output.enumerator = validateString(value.enumerator, incrementOptions('enumerator', opts));
  }
  NUMBERING_KEYS.filter((key) => key !== 'enumerator').forEach((key) => {
    if (defined(value[key])) {
      output[key] = validateBoolean(value[key], incrementOptions(key, opts));
    }
  });
  return output as Numbering;
}

/**
 * Validate KernelSpec object
 */
export function validateKernelSpec(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: KERNELSPEC_KEYS }, opts);
  if (value === undefined) return undefined;
  const output: KernelSpec = {};
  if (defined(value.name)) {
    output.name = validateString(value.name, incrementOptions('name', opts));
  }
  if (defined(value.language)) {
    output.language = validateString(value.language, incrementOptions('language', opts));
  }
  if (defined(value.display_name)) {
    output.display_name = validateString(
      value.display_name,
      incrementOptions('display_name', opts),
    );
  }
  if (defined(value.env)) {
    output.env = validateObject(value.env, incrementOptions('env', opts));
  }
  if (defined(value.argv)) {
    output.argv = validateList(value.argv, incrementOptions('argv', opts), (arg, index) => {
      return validateString(arg, incrementOptions(`argv.${index}`, opts));
    });
  }
  return output;
}

function validateTextRepresentation(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: TEXT_REPRESENTATION_KEYS }, opts);
  if (value === undefined) return undefined;
  const output: TextRepresentation = {};
  if (defined(value.extension)) {
    output.extension = validateString(value.extension, incrementOptions('extension', opts));
  }
  if (defined(value.format_name)) {
    output.format_name = validateString(value.format_name, incrementOptions('format_name', opts));
  }
  if (defined(value.format_version)) {
    // The format version ocassionally comes as a number in YAML, treat it as a string
    const format_version =
      typeof value.format_version === 'number'
        ? String(value.format_version)
        : value.format_version;
    output.format_version = validateString(
      format_version,
      incrementOptions('format_version', opts),
    );
  }
  if (defined(value.jupytext_version)) {
    output.jupytext_version = validateString(
      value.jupytext_version,
      incrementOptions('jupytext_version', opts),
    );
  }
  return output;
}

/**
 * Validate Jupytext object
 *
 * https://jupyterbook.org/en/stable/file-types/myst-notebooks.html
 */
export function validateJupytext(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: JUPYTEXT_KEYS }, opts);
  if (value === undefined) return undefined;
  const output: Jupytext = {};
  if (defined(value.formats)) {
    output.formats = validateString(value.formats, incrementOptions('formats', opts));
  }
  if (defined(value.text_representation)) {
    output.text_representation = validateTextRepresentation(
      value.text_representation,
      incrementOptions('text_representation', opts),
    );
  }
  return output;
}

export function validateExport(input: any, opts: ValidationOptions) {
  const value = validateObject(input, opts);
  if (value === undefined) return undefined;
  validateKeys(
    value,
    { required: ['format'], optional: RESERVED_EXPORT_KEYS },
    { ...opts, suppressWarnings: true },
  );
  if (value.format === undefined) return undefined;
  const format = validateEnum<ExportFormats>(value.format, {
    ...incrementOptions('format', opts),
    enum: ExportFormats,
  });
  if (format === undefined) return undefined;
  const output: Export = { ...value, format };
  if (value.template === null) {
    // It is possible for the template to explicitly be null.
    // This use no template (rather than default template).
    output.template = null;
  } else if (defined(value.template)) {
    output.template = validateString(value.template, incrementOptions('template', opts));
  }
  if (defined(value.output)) {
    output.output = validateString(value.output, incrementOptions('output', opts));
  }
  return output;
}

export function validateGithubUrl(value: any, opts: ValidationOptions) {
  let github = value;
  if (typeof github === 'string') {
    const repo = github.match(GITHUB_USERNAME_REPO_REGEX);
    if (repo) {
      github = `https://github.com/${repo}`;
    }
  }
  return validateUrl(github, {
    ...incrementOptions('github', opts),
    includes: 'github',
  });
}

export function validateSiteFrontmatterKeys(value: Record<string, any>, opts: ValidationOptions) {
  const output: SiteFrontmatter = {};
  if (defined(value.title)) {
    output.title = validateString(value.title, incrementOptions('title', opts));
  }
  if (defined(value.description)) {
    output.description = validateString(value.description, incrementOptions('description', opts));
  }
  if (defined(value.venue)) {
    output.venue = validateVenue(value.venue, incrementOptions('venue', opts));
  }
  if (defined(value.keywords)) {
    output.keywords = validateList(
      value.keywords,
      incrementOptions('keywords', opts),
      (word, ind) => {
        return validateString(word, incrementOptions(`keywords.${ind}`, opts));
      },
    );
  }
  return output;
}

export function validateProjectFrontmatterKeys(
  value: Record<string, any>,
  opts: ValidationOptions,
) {
  const output: ProjectFrontmatter = validateSiteFrontmatterKeys(value, opts);
  if (defined(value.authors)) {
    output.authors = validateList(
      value.authors,
      incrementOptions('authors', opts),
      (author, index) => {
        return validateAuthor(author, incrementOptions(`authors.${index}`, opts));
      },
    );
  }
  if (defined(value.date)) {
    output.date = validateDate(value.date, incrementOptions('date', opts));
  }
  if (defined(value.name)) {
    output.name = validateString(value.name, incrementOptions('name', opts));
  }
  if (defined(value.doi)) {
    const doiOpts = incrementOptions('doi', opts);
    const doi = validateString(value.doi, doiOpts);
    if (doi !== undefined) {
      if (validate(doi)) {
        output.doi = doi;
      } else {
        validationError('must be valid DOI', doiOpts);
      }
    }
  }
  if (defined(value.arxiv)) {
    output.arxiv = validateUrl(value.arxiv, {
      ...incrementOptions('arxiv', opts),
      includes: 'arxiv.org',
    });
  }
  if (defined(value.open_access)) {
    output.open_access = validateBoolean(value.open_access, incrementOptions('open_access', opts));
  }
  if (defined(value.license)) {
    output.license = validateLicenses(value.license, incrementOptions('license', opts));
  }
  if (defined(value.github)) {
    output.github = validateGithubUrl(value.github, incrementOptions('github', opts));
  }
  if (defined(value.binder)) {
    output.binder = validateUrl(value.binder, incrementOptions('binder', opts));
  }
  if (defined(value.source)) {
    output.source = validateUrl(value.source, incrementOptions('source', opts));
  }
  if (defined(value.subject)) {
    output.subject = validateString(value.subject, {
      ...incrementOptions('subject', opts),
      maxLength: 40,
    });
  }
  if (defined(value.bibliography)) {
    output.bibliography = validateBibliography(
      value.bibliography,
      incrementOptions('bibliography', opts),
    );
  }
  if (defined(value.biblio)) {
    output.biblio = validateBiblio(value.biblio, incrementOptions('biblio', opts));
  }
  if (defined(value.oxa)) {
    // TODO: better oxa validation
    output.oxa = validateString(value.oxa, incrementOptions('oxa', opts));
  }
  if (defined(value.numbering)) {
    const numberingOpts = incrementOptions('numbering', opts);
    let numbering: boolean | Numbering | undefined = validateBoolean(value.numbering, {
      ...numberingOpts,
      suppressWarnings: true,
      suppressErrors: true,
    });
    // TODO: could add an error here for validation of a non-bool non-object
    if (numbering === undefined) {
      numbering = validateNumbering(value.numbering, numberingOpts);
    }
    if (numbering !== undefined) {
      output.numbering = numbering;
    }
  }
  if (defined(value.math)) {
    const mathOpts = incrementOptions('math', opts);
    const math = validateObject(value.math, mathOpts);
    if (math) {
      const stringKeys = Object.keys(math).filter((key) => {
        // Filter on non-string values
        return validateString(math[key], incrementOptions(key, mathOpts));
      });
      output.math = filterKeys(math, stringKeys);
    }
  }
  if (defined(value.exports)) {
    output.exports = validateList(value.exports, incrementOptions('exports', opts), (exp, ind) => {
      return validateExport(exp, incrementOptions(`exports.${ind}`, opts));
    });
  }
  // This is only for the project, and is not defined on pages
  if (defined(value.references)) {
    const referencesOpts = incrementOptions('references', opts);
    const references = validateObject(value.references, referencesOpts);
    if (references) {
      output.references = Object.fromEntries(
        Object.keys(references)
          .map((key) => {
            const url = validateUrl(references[key], incrementOptions(key, referencesOpts));
            if (!url) return undefined;
            return [key, { url }];
          })
          .filter((exists) => !!exists) as [string, { url: string }][],
      );
    }
  }
  return output;
}

export function validatePageFrontmatterKeys(value: Record<string, any>, opts: ValidationOptions) {
  const output: PageFrontmatter = validateProjectFrontmatterKeys(value, opts);
  if (defined(value.subtitle)) {
    output.subtitle = validateString(value.subtitle, incrementOptions('subtitle', opts));
  }
  if (defined(value.short_title)) {
    output.short_title = validateString(value.short_title, {
      ...incrementOptions('short_title', opts),
      maxLength: 40,
    });
  }
  if (defined(value.kernelspec)) {
    output.kernelspec = validateKernelSpec(value.kernelspec, incrementOptions('kernelspec', opts));
  }
  if (defined(value.jupytext)) {
    output.jupytext = validateJupytext(value.jupytext, incrementOptions('jupytext', opts));
  }
  if (defined(value.tags)) {
    output.tags = validateList(
      value.tags,
      incrementOptions('tags', opts),
      (file, index: number) => {
        return validateString(file, incrementOptions(`tags.${index}`, opts));
      },
    );
  }
  if (value.thumbnail === null) {
    // It is possible for the thumbnail to explicitly be null.
    // This means not to look to the images in a page.
    output.thumbnail = null;
  } else if (defined(value.thumbnail)) {
    output.thumbnail = validateString(value.thumbnail, incrementOptions('thumbnail', opts));
  }
  if (defined(value.thumbnailOptimized)) {
    // No validation, this is expected to be set programatically
    output.thumbnailOptimized = value.thumbnailOptimized;
  }
  return output;
}

/**
 * Validate SiteFrontmatter object against the schema
 */
export function validateSiteFrontmatter(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: SITE_FRONTMATTER_KEYS }, opts) || {};
  return validateSiteFrontmatterKeys(value, opts) as SiteFrontmatter;
}

/**
 * Validate ProjectFrontmatter object against the schema
 */
export function validateProjectFrontmatter(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: PROJECT_FRONTMATTER_KEYS }, opts) || {};
  return validateProjectFrontmatterKeys(value, opts);
}

/**
 * Validate single PageFrontmatter object against the schema
 */
export function validatePageFrontmatter(input: any, opts: ValidationOptions) {
  const value = validateObjectKeys(input, { optional: PAGE_FRONTMATTER_KEYS }, opts) || {};
  return validatePageFrontmatterKeys(value, opts);
}

/**
 * Fill missing values from page frontmatter object with values from project frontmatter
 *
 * This only applies to frontmatter values where overriding is the correct behavior.
 * For example, if page has no 'title' the project 'title' is not filled in.
 */
export function fillPageFrontmatter(
  pageFrontmatter: PageFrontmatter,
  projectFrontmatter: ProjectFrontmatter,
  siteFrontmatter?: SiteFrontmatter,
) {
  if (siteFrontmatter) {
    projectFrontmatter = fillMissingKeys(projectFrontmatter, siteFrontmatter, USE_SITE_FALLBACK);
  }
  const frontmatter = fillMissingKeys(pageFrontmatter, projectFrontmatter, USE_PROJECT_FALLBACK);

  // If numbering is an object, combine page and project settings.
  // Otherwise, the value filled above is correct.
  if (
    typeof pageFrontmatter.numbering === 'object' &&
    typeof projectFrontmatter.numbering === 'object'
  ) {
    frontmatter.numbering = fillMissingKeys(
      pageFrontmatter.numbering,
      projectFrontmatter.numbering,
      NUMBERING_KEYS,
    );
  }

  // Combine all math macros defined on page and project
  if (projectFrontmatter.math || pageFrontmatter.math) {
    frontmatter.math = { ...(projectFrontmatter.math ?? {}), ...(pageFrontmatter.math ?? {}) };
  }

  return frontmatter;
}

/**
 * Unnest `kernelspec` from `jupyter.kernelspec`
 */
export function unnestKernelSpec(pageFrontmatter: Record<string, any>) {
  if (pageFrontmatter.jupyter?.kernelspec) {
    // TODO: When we are exporting from local state, we will need to be more careful to
    // round-trip this correctly.
    pageFrontmatter.kernelspec = pageFrontmatter.jupyter.kernelspec;
    // This cleanup prevents warning on `jupyter.kernelspec` but keeps warnings if other
    // keys exist under `jupyter`
    delete pageFrontmatter.jupyter.kernelspec;
    if (!Object.keys(pageFrontmatter.jupyter).length) {
      delete pageFrontmatter.jupyter;
    }
  }
}
