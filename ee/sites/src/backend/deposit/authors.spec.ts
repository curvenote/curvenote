// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line import/no-extraneous-dependencies
import { toXml } from 'xast-util-to-xml';
import { contributorsFromFrontmatter } from './authors.js';

describe('contributorsFromFrontmatter', () => {
  it('maps nameParsed, ORCID and affiliation records', () => {
    const { element, authors, issues } = contributorsFromFrontmatter({
      authors: [
        {
          id: 'spurves',
          name: 'Steve Purves',
          nameParsed: { literal: 'Steve Purves', given: 'Steve', family: 'Purves' },
          orcid: 'https://orcid.org/0000-0002-0760-5497',
          affiliations: ['curvenote'],
        },
        {
          name: 'Ada Lovelace',
          nameParsed: { literal: 'Ada Lovelace', given: 'Ada', family: 'Lovelace' },
        },
      ],
      affiliations: [
        {
          id: 'curvenote',
          name: 'Curvenote Inc.',
          department: 'Publications Team',
          country: 'Canada',
        },
      ],
    });
    expect(issues).toEqual([]);
    const xml = toXml(element!);
    expect(xml).toContain('<person_name sequence="first" contributor_role="author">');
    expect(xml).toContain('<institution_name>Curvenote Inc.</institution_name>');
    expect(xml).toContain('<institution_department>Publications Team</institution_department>');
    expect(xml).toContain('<ORCID>https://orcid.org/0000-0002-0760-5497</ORCID>');
    expect(xml).toContain('<person_name sequence="additional" contributor_role="author">');
    expect(authors).toEqual([
      { name: 'Steve Purves', orcid: '0000-0002-0760-5497' },
      { name: 'Ada Lovelace', orcid: undefined },
    ]);
  });

  it('splits a bare name and warns, and turns bare affiliation strings into institutions', () => {
    const { element, issues } = contributorsFromFrontmatter({
      authors: [{ name: 'John Armitage', affiliations: ['IFP Energies Nouvelles'] }],
    });
    const xml = toXml(element!);
    expect(xml).toContain('<given_name>John</given_name><surname>Armitage</surname>');
    expect(xml).toContain('<institution_name>IFP Energies Nouvelles</institution_name>');
    expect(issues).toEqual([
      {
        severity: 'warning',
        code: 'author_name_unparsed',
        message:
          'Name of "John Armitage" was split on its last space; check given and family names.',
        path: 'authors[0]',
      },
    ]);
  });

  it('returns no element and a warning when there are no authors', () => {
    expect(contributorsFromFrontmatter({})).toEqual({
      element: undefined,
      authors: [],
      issues: [{ severity: 'warning', code: 'missing_authors', message: 'No authors found.' }],
    });
  });

  it('uppercases a lowercase orcid check digit for Crossref (orcid_t only accepts X)', () => {
    const { element, issues } = contributorsFromFrontmatter({
      authors: [
        {
          name: 'Steve Purves',
          nameParsed: { literal: 'Steve Purves', given: 'Steve', family: 'Purves' },
          orcid: 'https://orcid.org/0000-0002-1825-009x',
        },
      ],
    });
    expect(issues).toEqual([]);
    const xml = toXml(element!);
    expect(xml).toContain('<ORCID>https://orcid.org/0000-0002-1825-009X</ORCID>');
  });

  it('skips a single-word name with a warning', () => {
    const { element, issues } = contributorsFromFrontmatter({ authors: [{ name: 'Plato' }] });
    expect(element).toBeUndefined();
    expect(issues.map((i) => i.code)).toEqual(['author_name_unparsed', 'missing_authors']);
  });
});
