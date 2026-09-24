import type { DepositIssue } from '../../backend/deposit/types.js';

/** What the author adds to clear each missing-field issue; they share one "Add … " sentence. */
const MISSING_FIELDS: Record<string, string> = {
  missing_title: 'a title',
  missing_date: 'a publication date',
};

const CONTENT_NOT_FOUND =
  'Published content not found. Publish the submission again to register a DOI.';

/** Row copy for the other blocking codes; the mapper's own messages stay for logs. */
const ISSUE_SENTENCES: Record<string, string> = {
  no_cdn: CONTENT_NOT_FOUND,
  no_page: CONTENT_NOT_FOUND,
  not_found: CONTENT_NOT_FOUND,
};

export type DoiBlockers =
  | { kind: 'site_not_active' }
  | { kind: 'kind_not_eligible'; sentence: string }
  | { kind: 'submission'; sentences: string[] };

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The DOI row's copy for a blocked deposit. Site setup hides the rest, and so does a kind that
 * cannot receive DOIs: until either is fixed, fixing the submission doesn't unblock anything.
 */
export function describeDoiBlockers(issues: DepositIssue[]): DoiBlockers {
  if (issues.some((issue) => issue.code === 'site_not_active')) {
    return { kind: 'site_not_active' };
  }
  const notEligible = issues.find((issue) => issue.code === 'kind_not_eligible');
  if (notEligible) {
    return { kind: 'kind_not_eligible', sentence: notEligible.message };
  }
  const fields = issues.map((issue) => MISSING_FIELDS[issue.code]).filter(Boolean);
  const others = issues
    .filter((issue) => !(issue.code in MISSING_FIELDS))
    .map((issue) => ISSUE_SENTENCES[issue.code] ?? issue.message);
  const sentences = [...new Set(others)];
  if (fields.length > 0) {
    sentences.unshift(`Add ${joinWithAnd([...new Set(fields)])} to register a DOI.`);
  }
  return { kind: 'submission', sentences };
}
