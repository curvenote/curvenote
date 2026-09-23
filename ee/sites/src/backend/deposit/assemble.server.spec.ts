// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import { lapalmaSource } from './fixtures/source.lapalma.js';
import type * as SourceServer from './source.server.js';

const source = vi.hoisted(() => ({ loadDepositSource: vi.fn() }));
vi.mock('./source.server.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SourceServer>();
  return {
    DepositSourceError: actual.DepositSourceError,
    loadDepositSource: source.loadDepositSource,
  };
});

import { assembleDeposit } from './assemble.server.js';
import { DepositSourceError } from './source.server.js';

const opts = {
  doi: '10.62329/abcd1234',
  batchId: 'batch-1',
  depositorEmail: 'doi@curvenote.com',
  resourceUrlBase: 'https://doi.curvenote.com',
  timestamp: 0,
};

describe('assembleDeposit', () => {
  it('produces posted_content XML for a complete source', async () => {
    source.loadDepositSource.mockResolvedValue(lapalmaSource());
    const result = await assembleDeposit({} as any, 'sv-lapalma', opts);
    expect(result.issues).toEqual([]);
    expect(result.doi).toBe('10.62329/abcd1234');
    expect(result.xml).toContain('<doi_batch_id>batch-1</doi_batch_id>');
    expect(result.xml).toContain('<posted_content>');
    expect(result.xml).toContain(
      '<resource content_version="vor">https://doi.curvenote.com/10.62329/abcd1234</resource>',
    );
    expect(result.summary?.title).toBe('La Palma Seismicity 2021');
  });

  it('still produces XML when only warnings are raised', async () => {
    source.loadDepositSource.mockResolvedValue(
      lapalmaSource({
        abstractMdast: undefined,
        frontmatter: {
          ...lapalmaSource().frontmatter,
          license: { content: { id: 'proprietary', CC: false } },
        },
      }),
    );
    const result = await assembleDeposit({} as any, 'sv-lapalma', opts);
    expect(result.xml).toBeDefined();
    expect(result.xml).toContain('<posted_content>');
    expect(result.issues.map((i) => i.code)).toEqual(['missing_abstract', 'missing_license']);
  });

  it('returns issues and no xml when the mapper blocks', async () => {
    source.loadDepositSource.mockResolvedValue(lapalmaSource({ frontmatter: { authors: [] } }));
    const result = await assembleDeposit({} as any, 'sv-lapalma', opts);
    expect(result.xml).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.issues.map((i) => i.code)).toContain('missing_title');
  });

  it('reports a not_found loader failure as a blocking issue instead of throwing', async () => {
    source.loadDepositSource.mockRejectedValue(
      new DepositSourceError('not_found', 'Submission version sv-lapalma not found.'),
    );
    const result = await assembleDeposit({} as any, 'sv-lapalma', opts);
    expect(result.xml).toBeUndefined();
    expect(result.doi).toBe('10.62329/abcd1234');
    expect(result.issues).toEqual([
      {
        severity: 'blocking',
        code: 'not_found',
        message: 'Submission version sv-lapalma not found.',
      },
    ]);
  });

  it('reports a no_cdn loader failure as a blocking issue instead of throwing', async () => {
    source.loadDepositSource.mockRejectedValue(
      new DepositSourceError('no_cdn', 'The work version has no CDN content.'),
    );
    const result = await assembleDeposit({} as any, 'sv-lapalma', opts);
    expect(result.xml).toBeUndefined();
    expect(result.issues).toEqual([
      { severity: 'blocking', code: 'no_cdn', message: 'The work version has no CDN content.' },
    ]);
  });

  it('re-throws an error that is not a DepositSourceError', async () => {
    source.loadDepositSource.mockRejectedValue(new Error('boom'));
    await expect(assembleDeposit({} as any, 'sv-lapalma', opts)).rejects.toThrow('boom');
  });
});
