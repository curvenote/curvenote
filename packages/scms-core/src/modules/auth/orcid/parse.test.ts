// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { parseOrcidAffiliations } from './parse.js';

/** Real ORCID employments response: two groups, first has disambiguated-organization null, second has ROR. */
const employmentsWithRor = {
  'last-modified-date': { value: 1764225136284 },
  'affiliation-group': [
    {
      'last-modified-date': { value: 1764225136284 },
      'external-ids': { 'external-id': [] },
      summaries: [
        {
          'employment-summary': {
            'created-date': { value: 1764225099076 },
            'last-modified-date': { value: 1764225136284 },
            source: {
              'source-orcid': {
                uri: 'https://orcid.org/0000-0002-7859-8394',
                path: '0000-0002-7859-8394',
                host: 'orcid.org',
              },
              'source-client-id': null,
              'source-name': { value: 'Rowan Cockett' },
              'assertion-origin-orcid': null,
              'assertion-origin-client-id': null,
              'assertion-origin-name': null,
            },
            'put-code': 33095363,
            'department-name': null,
            'role-title': 'Co-founder',
            'start-date': { year: { value: '2024' }, month: null, day: null },
            'end-date': null,
            organization: {
              name: 'Continuous Science Foundation',
              address: { city: 'Canmore', region: 'AB', country: 'CA' },
              'disambiguated-organization': null,
            },
            url: { value: 'https://continuousfoundation.org' },
            'external-ids': null,
            'display-index': '0',
            visibility: 'public',
            path: '/0000-0002-7859-8394/employment/33095363',
          },
        },
      ],
    },
    {
      'last-modified-date': { value: 1721143721397 },
      'external-ids': { 'external-id': [] },
      summaries: [
        {
          'employment-summary': {
            'created-date': { value: 1719465591284 },
            'last-modified-date': { value: 1721143721397 },
            source: {
              'source-orcid': {
                uri: 'https://orcid.org/0000-0002-7859-8394',
                path: '0000-0002-7859-8394',
                host: 'orcid.org',
              },
              'source-client-id': null,
              'source-name': { value: 'Rowan Cockett' },
              'assertion-origin-orcid': null,
              'assertion-origin-client-id': null,
              'assertion-origin-name': null,
            },
            'put-code': 24287175,
            'department-name': null,
            'role-title': 'CEO / Founder',
            'start-date': {
              year: { value: '2019' },
              month: { value: '09' },
              day: { value: '01' },
            },
            'end-date': null,
            organization: {
              name: 'Curvenote Inc. (Canada)',
              address: { city: 'Canmore', region: null, country: 'CA' },
              'disambiguated-organization': {
                'disambiguated-organization-identifier': 'https://ror.org/02mz0e468',
                'disambiguation-source': 'ROR',
              },
            },
            url: { value: 'https://curvenote.com' },
            'external-ids': null,
            'display-index': '0',
            visibility: 'public',
            path: '/0000-0002-7859-8394/employment/24287175',
          },
        },
      ],
    },
  ],
  path: '/0000-0002-7859-8394/employments',
};

describe('parseOrcidAffiliations', () => {
  it('extracts ROR when disambiguated-organization has direct string identifier and source', () => {
    const out = parseOrcidAffiliations(employmentsWithRor);
    expect(out).toHaveLength(2);
    const noRor = out.find((a) => a.name === 'Continuous Science Foundation');
    const withRor = out.find((a) => a.name === 'Curvenote Inc. (Canada)');
    expect(noRor).toBeDefined();
    expect(noRor?.ror).toBeUndefined();
    expect(withRor).toBeDefined();
    expect(withRor?.ror).toBe('https://ror.org/02mz0e468');
  });

  it('extracts ROR when identifier/source are value-wrapped (application/json style)', () => {
    const wrapped = {
      'affiliation-group': [
        {
          summaries: [
            {
              'employment-summary': {
                organization: {
                  name: 'Test Org',
                  'disambiguated-organization': {
                    'disambiguation-source': { value: 'ROR' },
                    'disambiguated-organization-identifier': {
                      value: 'https://ror.org/04fa4r544',
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const out = parseOrcidAffiliations(wrapped);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Test Org');
    expect(out[0].ror).toBe('https://ror.org/04fa4r544');
  });
});
