// Shapes copied from the seeded "La Palma Seismicity 2021" article on the local dev CDN (2026-09-21).
import type { DepositSource } from '../types.js';

export function lapalmaSource(overrides: Partial<DepositSource> = {}): DepositSource {
  return {
    submissionVersionId: 'sv-lapalma',
    siteId: 'site-a',
    kind: { title: 'Article', doiContentType: 'PREPRINT' },
    doiConfig: { status: 'ACTIVE', prefix: '10.62329', role: null },
    dates: {
      submissionPublished: '2022-10-11T00:00:00.000Z',
      versionPublished: '2022-10-12T00:00:00.000Z',
      workVersion: '2021-11-10T00:00:00.000Z',
    },
    frontmatter: {
      title: 'La Palma Seismicity 2021',
      subtitle: 'An analysis of earthquake swarms',
      date: '2021-11-10T00:00:00.000Z',
      license: {
        content: {
          id: 'CC-BY-SA-4.0',
          CC: true,
          url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
      authors: [
        {
          id: 'spurves',
          name: 'Steve Purves',
          nameParsed: { literal: 'Steve Purves', given: 'Steve', family: 'Purves' },
          orcid: '0000-0002-0760-5497',
          affiliations: ['curvenote'],
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
    },
    // Shape returned by extractPart(page.mdast, 'abstract'): a root wrapping the part block (verified 2026-09-21).
    abstractMdast: {
      type: 'root',
      children: [
        {
          type: 'block',
          data: { part: 'abstract' },
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  value: 'In September 2021 a seismic swarm started under La Palma.',
                },
              ],
            },
          ],
        },
      ],
    },
    citations: { Oldenburg_2005: '10.1190/1.9781560801719.ch5' },
    ...overrides,
  };
}

export const lapalmaOptions = {
  doi: '10.62329/abcd1234',
  batchId: '019a-batch',
  timestamp: 1_700_000_000_000,
  resourceUrl: 'https://doi.example.com/10.62329/abcd1234',
  depositor: { name: 'Curvenote', email: 'doi@curvenote.com' },
};
