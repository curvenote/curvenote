// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line import/no-extraneous-dependencies
import { toXml } from 'xast-util-to-xml';
import { depositTypeForKind, toDeposit } from './mapper.js';
import { lapalmaOptions, lapalmaSource } from './fixtures/source.lapalma.js';

describe('depositTypeForKind', () => {
  it('maps every kind to posted_content in the MVP', () => {
    expect(depositTypeForKind('Article')).toBe('posted_content');
    expect(depositTypeForKind('Anything')).toBe('posted_content');
  });
});

describe('toDeposit', () => {
  it('maps a complete source with no issues', () => {
    const { preprint, batch, issues } = toDeposit(lapalmaSource(), lapalmaOptions);
    expect(issues).toEqual([]);
    expect(batch).toEqual({
      id: '019a-batch',
      timestamp: 1_700_000_000_000,
      depositor: { name: 'Curvenote', email: 'doi@curvenote.com' },
    });
    expect(preprint).toMatchObject({
      title: 'La Palma Seismicity 2021',
      subtitle: 'An analysis of earthquake swarms',
      date: new Date('2022-10-11T00:00:00.000Z'),
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
      doi_data: {
        doi: '10.62329/abcd1234',
        resource: 'https://doi.curvenote.com/10.62329/abcd1234',
      },
      citations: { Oldenburg_2005: '10.1190/1.9781560801719.ch5' },
    });
    expect(toXml(preprint!.abstract!)).toContain('<jats:p>In September 2021');
    expect(toXml(preprint!.contributors!)).toContain('<surname>Purves</surname>');
  });

  it('summarises the same values the preprint is built from', () => {
    const { summary } = toDeposit(lapalmaSource(), lapalmaOptions);
    expect(summary).toEqual({
      title: 'La Palma Seismicity 2021',
      subtitle: 'An analysis of earthquake swarms',
      date: '2022-10-11T00:00:00.000Z',
      authors: expect.arrayContaining([{ name: 'Steve Purves', orcid: '0000-0002-0760-5497' }]),
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
      hasAbstract: true,
      citationCount: 1,
    });
  });

  it('leaves the summary out when something blocks', () => {
    const { summary } = toDeposit(lapalmaSource({ frontmatter: { authors: [] } }), lapalmaOptions);
    expect(summary).toBeUndefined();
  });

  it('uses the first publication as posted date, then WorkVersion.date', () => {
    const withoutSubmission = toDeposit(
      lapalmaSource({ dates: { workVersion: '2021-11-10T00:00:00.000Z' } }),
      lapalmaOptions,
    );
    expect(withoutSubmission.preprint?.date).toEqual(new Date('2021-11-10T00:00:00.000Z'));
  });

  it('blocks on missing title, missing date and inactive site', () => {
    const { preprint, issues } = toDeposit(
      lapalmaSource({
        frontmatter: { authors: [] },
        dates: {},
        doiConfig: { status: 'PENDING_ROLE', prefix: '10.5555', role: null },
      }),
      lapalmaOptions,
    );
    expect(preprint).toBeUndefined();
    expect(issues.filter((i) => i.severity === 'blocking').map((i) => i.code)).toEqual([
      'site_not_active',
      'missing_title',
      'missing_date',
    ]);
  });

  it('warns on missing abstract, non-CC licence and missing authors', () => {
    const { preprint, issues } = toDeposit(
      lapalmaSource({
        abstractMdast: undefined,
        frontmatter: {
          title: 'T',
          authors: [],
          license: { content: { id: 'MIT', url: 'https://opensource.org/licenses/MIT' } },
        },
      }),
      lapalmaOptions,
    );
    expect(preprint).toBeDefined();
    expect(preprint?.license).toBeUndefined();
    expect(preprint?.abstract).toBeUndefined();
    expect(issues.map((i) => i.code).sort()).toEqual([
      'missing_abstract',
      'missing_authors',
      'missing_license',
    ]);
  });

  it('omits citations when there are none', () => {
    const { preprint } = toDeposit(lapalmaSource({ citations: {} }), lapalmaOptions);
    expect(preprint?.citations).toBeUndefined();
  });

  it('does not mutate the source abstractMdast', () => {
    // abstractFromMdast rewrites newlines in text nodes in place; a literal newline here makes
    // that mutation observable, so this test actually fails without the defensive clone.
    const abstractMdast = {
      type: 'root',
      children: [
        {
          type: 'block',
          data: { part: 'abstract' },
          children: [
            { type: 'paragraph', children: [{ type: 'text', value: 'Line one\nline two.' }] },
          ],
        },
      ],
    };
    const source = lapalmaSource({ abstractMdast });
    const before = structuredClone(source.abstractMdast);
    toDeposit(source, lapalmaOptions);
    expect(source.abstractMdast).toEqual(before);
  });
});
