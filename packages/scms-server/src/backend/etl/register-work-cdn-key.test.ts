// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { cdnKeyUnderArticle } from './register-work-cdn-key.js';
import { resolveEtlRegisterDecision } from './register-work.server.js';

describe('cdnKeyUnderArticle', () => {
  const article = 'Batch_01/10.1101/2024.05.01.111111';

  test('accepts exact article root', () => {
    expect(cdnKeyUnderArticle(article, article)).toBe(true);
  });

  test('accepts paths under article folder', () => {
    expect(cdnKeyUnderArticle(article, `${article}/_updated_versions/2026-06-10T12-00-00Z`)).toBe(
      true,
    );
  });

  test('rejects sibling article folder (duplicate DOI)', () => {
    const other = 'Batch_01/10.1101/2024.05.01.222222';
    expect(cdnKeyUnderArticle(article, other)).toBe(false);
    expect(cdnKeyUnderArticle(other, article)).toBe(false);
  });
});

describe('resolveEtlRegisterDecision retagging ownership', () => {
  const articleA = 'Batch_01/10.1101/2024.05.01.111111';
  const articleB = 'Batch_01/10.1101/2024.05.01.222222';

  test('permits retagging when tagged cdn_key is same article tree', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        articleCdnPrefix: articleA,
        taggedCdnKey: articleA,
        allowRetagging: true,
      }),
    ).toEqual({ action: 'create' });
  });

  test('blocks retagging when tag belongs to different article folder', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        articleCdnPrefix: articleB,
        taggedCdnKey: articleA,
        allowRetagging: true,
      }),
    ).toEqual({ action: 'skip', reason: 'article_cdn_prefix_mismatch' });
  });

  test('blocks retagging when article_cdn_prefix is omitted', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        taggedCdnKey: articleA,
        allowRetagging: true,
      }),
    ).toEqual({ action: 'skip', reason: 'article_cdn_prefix_mismatch' });
  });
});
