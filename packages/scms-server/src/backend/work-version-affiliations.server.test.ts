/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import {
  WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN,
  extractWorkVersionAffiliationsSearchTextFromMetadata,
} from './work-version-affiliations.server.js';

describe('work-version-affiliations', () => {
  test('exports the Postgres function name', () => {
    expect(WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN).toBe('work_version_affiliations_search_text');
  });

  test('concatenates affiliation text fields', () => {
    expect(
      extractWorkVersionAffiliationsSearchTextFromMetadata({
        'frontmatter.myst': {
          affiliations: [
            { name: 'Curvenote Labs', city: 'Halifax', country: 'Canada' },
            { institution: 'MIT', department: 'CS', state: 'MA' },
          ],
        },
      }),
    ).toBe('Curvenote Labs Halifax Canada MIT CS MA');
  });

  test('returns empty string when affiliations are absent', () => {
    expect(extractWorkVersionAffiliationsSearchTextFromMetadata(undefined)).toBe('');
    expect(extractWorkVersionAffiliationsSearchTextFromMetadata({})).toBe('');
    expect(extractWorkVersionAffiliationsSearchTextFromMetadata({ 'frontmatter.myst': {} })).toBe(
      '',
    );
  });
});
