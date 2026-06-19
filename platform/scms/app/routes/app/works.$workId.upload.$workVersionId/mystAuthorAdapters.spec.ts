// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  authorFieldToMystFrontmatter,
  deriveWorkVersionAuthors,
  mystFrontmatterToAuthorField,
} from './mystAuthorAdapters';

describe('myst author adapters', () => {
  it('hydrates normalized MyST affiliation mappings into AuthorField data', () => {
    const frontmatter = {
      title: 'Emergent speciation by multiple Dobzhansky-Muller incompatibilities',
      authors: [
        {
          id: 'contributors-generated-uid-0',
          name: 'Tiago Paixao',
          nameParsed: {
            given: 'Tiago',
            family: 'Paixao',
            literal: 'Tiago Paixao',
          },
          affiliations: ['a1', 'a2'],
        },
        {
          id: 'contributors-generated-uid-1',
          name: 'Kevin E. Bassler',
          affiliations: ['a3', 'a4', 'a5'],
        },
      ],
      affiliations: [
        {
          id: 'a1',
          name: 'Department of Biology and Biochemistry, University of Houston, Houston, TX 77204-5001.',
        },
        {
          id: 'a2',
          name: 'The Institute of Science and Technology Austria, Am Campus 1, Klosterneuburg 3400.',
          country: 'Austria',
        },
        { id: 'a3', name: 'Department of Physics, University of Houston.' },
        { id: 'a4', name: 'Texas Center for Superconductivity, University of Houston.' },
        {
          id: 'a5',
          name: 'Max Planck Institute for the Physics of Complex Systems.',
          country: 'Germany',
        },
      ],
    };

    const result = mystFrontmatterToAuthorField(frontmatter);

    expect(result.authors).toEqual([
      {
        id: 'contributors-generated-uid-0',
        name: 'Tiago Paixao',
        corresponding: false,
        affiliationIds: ['a1', 'a2'],
      },
      {
        id: 'contributors-generated-uid-1',
        name: 'Kevin E. Bassler',
        corresponding: false,
        affiliationIds: ['a3', 'a4', 'a5'],
      },
    ]);
    expect(result.affiliations[1]).toMatchObject({
      id: 'a2',
      country: 'Austria',
    });
  });

  it('normalizes inline affiliations and generated author ids', () => {
    const result = mystFrontmatterToAuthorField({
      authors: [
        {
          name: 'Marissa Myst',
          affiliations: [
            {
              id: 'ubc',
              institution: 'University of British Columbia',
              ror: 'https://ror.org/03rmrcq20',
              department: 'Earth, Ocean and Atmospheric Sciences',
            },
            'ACME Inc',
          ],
        },
      ],
    });

    expect(result.authors).toEqual([
      {
        id: 'contributors-generated-uid-0',
        name: 'Marissa Myst',
        corresponding: false,
        affiliationIds: ['ubc', 'ACME Inc'],
      },
    ]);
    expect(result.affiliations).toEqual([
      {
        id: 'ubc',
        name: 'University of British Columbia',
        ror: 'https://ror.org/03rmrcq20',
        department: 'Earth, Ocean and Atmospheric Sciences',
      },
      {
        id: 'ACME Inc',
        name: 'ACME Inc',
      },
    ]);
  });

  it('round-trips edited authors while preserving unrelated frontmatter and extra fields', () => {
    const existing = {
      doi: '10.1101/008268',
      abbreviations: { DMI: 'Dobzhansky-Muller incompatibility' },
      authors: [
        {
          id: 'contributors-generated-uid-0',
          name: 'Tiago Paixao',
          nameParsed: { given: 'Tiago', family: 'Paixao', literal: 'Tiago Paixao' },
          note: 'Equal contribution',
          affiliations: ['a1'],
        },
      ],
      affiliations: [
        {
          id: 'a1',
          name: 'Old affiliation',
          isni: '0000 0001 2288 9830',
        },
      ],
    };

    const updated = authorFieldToMystFrontmatter(
      {
        authors: [
          {
            id: 'contributors-generated-uid-0',
            name: 'Tiago Paixao Jr',
            email: 'tiago@example.com',
            corresponding: true,
            affiliationIds: ['a1'],
          },
        ],
        affiliations: [{ id: 'a1', name: 'New affiliation', country: 'Austria' }],
      },
      existing,
    );

    expect(updated.doi).toBe('10.1101/008268');
    expect(updated.abbreviations).toEqual({ DMI: 'Dobzhansky-Muller incompatibility' });
    expect(updated.authors?.[0]).toEqual({
      id: 'contributors-generated-uid-0',
      name: 'Tiago Paixao Jr',
      note: 'Equal contribution',
      affiliations: ['a1'],
      email: 'tiago@example.com',
      corresponding: true,
    });
    expect(updated.affiliations?.[0]).toEqual({
      id: 'a1',
      name: 'New affiliation',
      isni: '0000 0001 2288 9830',
      country: 'Austria',
    });
    expect(deriveWorkVersionAuthors(updated.authors ?? [])).toEqual(['Tiago Paixao Jr']);
  });

  it('removes affiliations omitted by the AuthorField payload', () => {
    const existing = {
      authors: [
        {
          id: 'contributors-generated-uid-0',
          name: 'Tiago Paixao',
          affiliations: ['a1', 'a2'],
        },
      ],
      affiliations: [
        { id: 'a1', name: 'Department of Biology and Biochemistry' },
        { id: 'a2', name: 'Institute of Science and Technology Austria' },
      ],
    };

    const updated = authorFieldToMystFrontmatter(
      {
        authors: [
          {
            id: 'contributors-generated-uid-0',
            name: 'Tiago Paixao',
            affiliationIds: ['a1'],
          },
        ],
        affiliations: [{ id: 'a1', name: 'Department of Biology and Biochemistry' }],
      },
      existing,
    );

    expect(updated.authors?.[0]?.affiliations).toEqual(['a1']);
    expect(updated.affiliations).toEqual([
      { id: 'a1', name: 'Department of Biology and Biochemistry' },
    ]);
  });
});
