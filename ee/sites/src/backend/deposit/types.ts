import type { GenericParent } from 'myst-common';
import type { DoiBatchOptions, Preprint } from 'crossref-utils-sdk';

export type DepositIssue = {
  severity: 'blocking' | 'warning';
  code: string;
  message: string;
  path?: string;
};

export type DepositAuthor = {
  id?: string;
  name?: string;
  nameParsed?: { literal?: string; given?: string; family?: string };
  orcid?: string;
  /** Affiliation ids, or bare names on older builds. */
  affiliations?: string[];
};

export type DepositAffiliation = {
  id?: string;
  name?: string;
  institution?: string;
  ror?: string;
  department?: string;
  city?: string;
  country?: string;
};

export type DepositLicense = { id?: string; url?: string; CC?: boolean };

/** The frontmatter fields a posted_content deposit reads, after the overlay. */
export type DepositFrontmatter = {
  title?: string;
  subtitle?: string;
  date?: string;
  license?: { content?: DepositLicense } | string;
  authors?: DepositAuthor[];
  affiliations?: DepositAffiliation[];
};

export type DepositSource = {
  submissionVersionId: string;
  siteId: string;
  kindName: string;
  doiConfig: { status: string; prefix: string; role: string | null } | null;
  dates: {
    /** `Submission.date_published`. */
    submissionPublished?: string;
    /** `SubmissionVersion.date_published`. Not read by the mapper. */
    versionPublished?: string;
    /** `WorkVersion.date`. */
    workVersion?: string;
  };
  frontmatter: DepositFrontmatter;
  abstractMdast?: GenericParent;
  /** citation key -> DOI, from the index page's references. */
  citations: Record<string, string>;
};

export type DepositOptions = {
  doi: string;
  batchId: string;
  timestamp: number;
  resourceUrl: string;
  depositor: { name: string; email: string };
};

/** What the Register DOI dialog shows: the same values the preprint is built from, readable. */
export type DepositSummary = {
  title: string;
  subtitle?: string;
  /** Posted date, ISO. */
  date: string;
  authors: { name: string; orcid?: string }[];
  license?: string;
  hasAbstract: boolean;
  citationCount: number;
};

export type MappedDeposit = {
  preprint?: Preprint;
  /** Present exactly when `preprint` is. */
  summary?: DepositSummary;
  batch: DoiBatchOptions;
  issues: DepositIssue[];
};

export type AssembledDeposit = {
  xml?: string;
  summary?: DepositSummary;
  issues: DepositIssue[];
  doi: string;
};

export const DEPOSITOR_NAME = 'Curvenote';
