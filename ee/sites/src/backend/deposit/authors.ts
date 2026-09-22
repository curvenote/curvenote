import type { Element } from 'xast';
import { contributorXml, e } from 'crossref-utils-sdk';
import type { ContributorOptions } from 'crossref-utils-sdk';
import { extractOrcidId } from '@curvenote/scms-core';
import type {
  DepositAffiliation,
  DepositAuthor,
  DepositFrontmatter,
  DepositIssue,
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
      severity: 'warning',
      code: 'author_name_unparsed',
      message: `Name "${literal || '(empty)'}" has no family name and was left out.`,
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

/** Crossref `<contributors>` from merged frontmatter. Missing pieces become warnings, never throws. */
export function contributorsFromFrontmatter(fm: DepositFrontmatter): {
  element?: Element;
  issues: DepositIssue[];
} {
  const issues: DepositIssue[] = [];
  const records = fm.affiliations ?? [];
  const people: Element[] = [];
  (fm.authors ?? []).forEach((author, index) => {
    const nameParsed = parseName(author, index, issues);
    if (!nameParsed) {
      return;
    }
    // extractOrcidId can return a lowercase check digit (e.g. '...000x'); Crossref's orcid_t
    // pattern only accepts uppercase 'X'.
    const orcid = author.orcid
      ? (extractOrcidId(author.orcid)?.toUpperCase() ?? undefined)
      : undefined;
    people.push(
      contributorXml({
        nameParsed,
        orcid,
        affiliations: affiliationsFor(author, records),
        sequence: people.length === 0 ? 'first' : 'additional',
        contributor_role: 'author',
      }),
    );
  });
  if (people.length === 0) {
    issues.push({ severity: 'warning', code: 'missing_authors', message: 'No authors found.' });
    return { element: undefined, issues };
  }
  return { element: e('contributors', people), issues };
}
