/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import {
  WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN,
  extractWorkVersionAffiliationsSearchTextFromMetadata,
  isAffiliationSearchEnabled,
} from './work-version-affiliations.server.js';

describe('work-version-affiliations', () => {
  test('exports the Postgres function name', () => {
    expect(WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN).toBe('work_version_affiliations_search_text');
  });

  describe('isAffiliationSearchEnabled', () => {
    test('is true when at least one token is not a stopword', () => {
      expect(isAffiliationSearchEnabled('Harvard Medical School')).toBe(true);
      expect(isAffiliationSearchEnabled('Wyss Institute')).toBe(true);
    });

    test('is false for stopword-only queries', () => {
      expect(isAffiliationSearchEnabled('University')).toBe(false);
      expect(isAffiliationSearchEnabled('University Department')).toBe(false);
      expect(isAffiliationSearchEnabled('medical school')).toBe(false);
    });

    test('is false for punctuated stopword-only queries', () => {
      expect(isAffiliationSearchEnabled('University,')).toBe(false);
      expect(isAffiliationSearchEnabled('school.')).toBe(false);
      expect(isAffiliationSearchEnabled('Department;')).toBe(false);
    });

    test('is false when every token is shorter than the minimum length', () => {
      expect(isAffiliationSearchEnabled('ab cd')).toBe(false);
    });
  });

  test('concatenates affiliation names from frontmatter.myst', () => {
    expect(
      extractWorkVersionAffiliationsSearchTextFromMetadata({
        'frontmatter.myst': {
          affiliations: [
            { id: 'a1', name: 'Systems Biology Department, Harvard Medical School' },
            {
              id: 'a2',
              name: 'Wyss Institute for Biologically Inspired Engineering, Harvard University',
            },
          ],
        },
      }),
    ).toBe(
      'Systems Biology Department, Harvard Medical School Wyss Institute for Biologically Inspired Engineering, Harvard University',
    );
  });

  test('falls back to institution when name is absent', () => {
    expect(
      extractWorkVersionAffiliationsSearchTextFromMetadata({
        'frontmatter.myst': {
          affiliations: [{ id: 'a1', institution: 'MIT' }],
        },
      }),
    ).toBe('MIT');
  });

  test('returns empty string when affiliations are absent', () => {
    expect(extractWorkVersionAffiliationsSearchTextFromMetadata(undefined)).toBe('');
    expect(extractWorkVersionAffiliationsSearchTextFromMetadata({})).toBe('');
    expect(extractWorkVersionAffiliationsSearchTextFromMetadata({ 'frontmatter.myst': {} })).toBe(
      '',
    );
  });
});
