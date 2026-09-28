import type { Element } from 'xast';
import { contributorXml, e } from 'crossref-utils-sdk';
import type { ContributorOptions } from 'crossref-utils-sdk';
import { extractOrcidId } from '@curvenote/scms-core';
import type {
  DepositAffiliation,
  DepositAuthor,
  DepositFrontmatter,
  DepositIssue,
  DepositSummary,
} from './types.js';

type ParsedName = { literal: string; given: string; family: string };

function parseName(
  author: DepositAuthor,
  index: number,
  issues: DepositIssue[],
): ParsedName | null {
  const parsed = author.nameParsed;
  if (parsed?.given && parsed?.family) {
    return {
      literal: parsed.literal ?? `${parsed.given} ${parsed.family}`,
      given: parsed.given,
      family: parsed.family,
    };
  }
  const literal = (author.name ?? parsed?.literal ?? '').trim();
  const cut = literal.lastIndexOf(' ');
  if (cut <= 0) {
    issues.push({
      severity: 'blocking',
      code: 'author_single_name',
      message: `"${literal || '(empty)'}" has only one name and cannot be included in the Crossref record. If it is an organization, mark it as a collaboration; if it is a person, add their given name.`,
      path: `authors[${index}]`,
    });
    return null;
  }
  issues.push({
    severity: 'warning',
    code: 'author_name_unparsed',
    message: `Name of "${literal}" was split on its last space; check given and family names.`,
    path: `authors[${index}]`,
  });
  return { literal, given: literal.slice(0, cut), family: literal.slice(cut + 1) };
}

function affiliationsFor(
  author: DepositAuthor,
  records: DepositAffiliation[],
): ContributorOptions['affiliations'] {
  return (author.affiliations ?? []).map((ref) => {
    const record = records.find((r) => r.id === ref);
    const name = record?.name ?? record?.institution ?? ref;
    return {
      id: record?.id ?? ref,
      name,
      ror: record?.ror,
      department: record?.department,
      city: record?.city,
      country: record?.country,
    };
  });
}

function organizationXml(name: string, sequence: 'first' | 'additional'): Element {
  return e('organization', { sequence, contributor_role: 'author' }, name);
}

/**
 * Crossref `<contributors>` from merged frontmatter: collaborations as organizations, everyone
 * else as people. A single-name person blocks; other gaps are warnings. Never throws.
 */
export function contributorsFromFrontmatter(fm: DepositFrontmatter): {
  element?: Element;
  /** The authors that made it into `element`, for the summary. */
  authors: DepositSummary['authors'];
  issues: DepositIssue[];
} {
  const issues: DepositIssue[] = [];
  const records = fm.affiliations ?? [];
  const elements: Element[] = [];
  const authors: DepositSummary['authors'] = [];
  (fm.authors ?? []).forEach((author, index) => {
    const sequence = elements.length === 0 ? 'first' : 'additional';
    if (author.collaboration && author.name) {
      authors.push({ name: author.name });
      elements.push(organizationXml(author.name, sequence));
      return;
    }
    const nameParsed = parseName(author, index, issues);
    if (!nameParsed) {
      return;
    }
    // extractOrcidId can return a lowercase check digit (e.g. '...000x'); Crossref's orcid_t
    // pattern only accepts uppercase 'X'.
    const orcid = author.orcid
      ? (extractOrcidId(author.orcid)?.toUpperCase() ?? undefined)
      : undefined;
    authors.push({ name: nameParsed.literal, orcid });
    elements.push(
      contributorXml({
        nameParsed,
        orcid,
        affiliations: affiliationsFor(author, records),
        sequence,
        contributor_role: 'author',
      }),
    );
  });
  if (elements.length === 0) {
    issues.push({ severity: 'warning', code: 'missing_authors', message: 'No authors found' });
    return { element: undefined, authors, issues };
  }
  return { element: e('contributors', elements), authors, issues };
}
