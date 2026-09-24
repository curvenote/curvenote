import { abstractFromMdast } from 'crossref-utils-sdk';
import type { Preprint } from 'crossref-utils-sdk';
import { DOI_CONTENT_TYPE, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';
import type { DoiContentType } from '@curvenote/scms-core';
import { contributorsFromFrontmatter } from './authors.js';
import type {
  DepositIssue,
  DepositOptions,
  DepositSource,
  DepositSummary,
  MappedDeposit,
} from './types.js';

/** A Crossref record type: the XML element, and its `type` attribute where it has one. */
export type CrossrefDepositType = { element: 'posted_content'; type: 'preprint' };

/**
 * Curvenote's DOI content types in Crossref's terms. `preprintXml` writes no `type` attribute:
 * `preprint` is the schema default for posted_content.
 */
const CROSSREF_DEPOSIT_TYPES = new Map<string, CrossrefDepositType>(
  Object.entries({
    [DOI_CONTENT_TYPE.PREPRINT]: { element: 'posted_content', type: 'preprint' },
  } satisfies Record<DoiContentType, CrossrefDepositType>),
);

/** What a kind's DOIs are deposited as. Null when it cannot receive DOIs, or the value is unknown. */
export function depositTypeForKind(doiContentType: string | null): CrossrefDepositType | null {
  if (doiContentType === null) {
    return null;
  }
  return CROSSREF_DEPOSIT_TYPES.get(doiContentType) ?? null;
}

export function kindNotEligibleMessage(kindTitle: string): string {
  return `Submissions of kind "${kindTitle}" can't receive DOIs. A site admin can enable it in DOI Registration.`;
}

function blocking(code: string, message: string): DepositIssue {
  return { severity: 'blocking', code, message };
}

function warning(code: string, message: string): DepositIssue {
  return { severity: 'warning', code, message };
}

/** Posted date: first publication of the submission (D4), else WorkVersion.date. */
function postedDate(source: DepositSource): Date | undefined {
  const raw = source.dates.submissionPublished ?? source.dates.workVersion;
  if (!raw) {
    return undefined;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Only CC licences go to Crossref's AccessIndicators, as the crossref-utils CLI does. */
function licenseUrl(source: DepositSource, issues: DepositIssue[]): string | undefined {
  const license = source.frontmatter.license;
  const content = typeof license === 'object' ? license?.content : undefined;
  if (content?.CC && content.url) {
    return content.url;
  }
  issues.push(
    warning(
      'missing_license',
      'No Creative Commons license found; the deposit carries no license.',
    ),
  );
  return undefined;
}

/**
 * Platform data -> SDK DTOs. Pure and deterministic; never throws: everything `preprintXml`
 * would throw on is reported as a blocking issue and `preprint` is left out.
 */
export function toDeposit(source: DepositSource, opts: DepositOptions): MappedDeposit {
  const issues: DepositIssue[] = [];
  const batch = { id: opts.batchId, timestamp: opts.timestamp, depositor: opts.depositor };
  if (!source.doiConfig || source.doiConfig.status !== SITE_DOI_CONFIG_STATUS.ACTIVE) {
    issues.push(blocking('site_not_active', 'The site is not set up for DOI registration.'));
  }
  if (!depositTypeForKind(source.kind.doiContentType)) {
    issues.push(blocking('kind_not_eligible', kindNotEligibleMessage(source.kind.title)));
  }
  const title = source.frontmatter.title?.trim();
  if (!title) {
    issues.push(blocking('missing_title', 'The article has no title.'));
  }
  const date = postedDate(source);
  if (!date) {
    issues.push(blocking('missing_date', 'No publication date found for the submission.'));
  }
  const contributors = contributorsFromFrontmatter(source.frontmatter);
  issues.push(...contributors.issues);
  // abstractFromMdast mutates the tree it's given (xref/cite/newline transforms); clone so
  // toDeposit stays pure and never touches the caller's source.
  const abstract = source.abstractMdast
    ? abstractFromMdast(structuredClone(source.abstractMdast))
    : undefined;
  if (!abstract) {
    issues.push(warning('missing_abstract', 'No abstract found.'));
  }
  const license = licenseUrl(source, issues);
  // `!title || !date` is already a blocking issue; repeated so TypeScript narrows both.
  if (!title || !date || issues.some((issue) => issue.severity === 'blocking')) {
    return { batch, issues };
  }
  const preprint: Preprint = {
    title,
    subtitle: source.frontmatter.subtitle || undefined,
    date,
    contributors: contributors.element,
    abstract,
    license,
    doi_data: { doi: opts.doi, resource: opts.resourceUrl },
    citations: Object.keys(source.citations).length > 0 ? source.citations : undefined,
  };
  const summary: DepositSummary = {
    title,
    subtitle: preprint.subtitle,
    date: date.toISOString(),
    authors: contributors.authors,
    license,
    hasAbstract: !!abstract,
    citationCount: Object.keys(source.citations).length,
  };
  return { preprint, summary, batch, issues };
}
