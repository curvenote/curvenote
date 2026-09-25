// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { DepositIssue } from '../../backend/deposit/types.js';
import { describeDoiBlockers } from './RegisterDoi.utils.js';

function issue(code: string, message = `${code} message`): DepositIssue {
  return { severity: 'blocking', code, message } as DepositIssue;
}

describe('describeDoiBlockers', () => {
  it('shows only the site setup when the site is not active', () => {
    expect(
      describeDoiBlockers([
        issue('missing_title'),
        issue('site_not_active'),
        issue('missing_date'),
      ]),
    ).toEqual({ kind: 'site_not_active' });
  });

  it('joins missing fields into one sentence', () => {
    expect(describeDoiBlockers([issue('missing_date'), issue('missing_title')])).toEqual({
      kind: 'submission',
      sentences: ['Add a publication date and a title to register a DOI.'],
    });
  });

  it('asks for a single missing field', () => {
    expect(describeDoiBlockers([issue('missing_title')])).toEqual({
      kind: 'submission',
      sentences: ['Add a title to register a DOI.'],
    });
  });

  it('collapses the content-missing codes into one sentence after the fields', () => {
    expect(
      describeDoiBlockers([issue('no_cdn'), issue('no_page'), issue('missing_title')]),
    ).toEqual({
      kind: 'submission',
      sentences: [
        'Add a title to register a DOI.',
        'Published content not found. Publish the submission again to register a DOI.',
      ],
    });
  });

  it("falls back to the mapper's message for unknown codes", () => {
    expect(describeDoiBlockers([issue('something_new', 'Something is off.')])).toEqual({
      kind: 'submission',
      sentences: ['Something is off.'],
    });
  });
});
