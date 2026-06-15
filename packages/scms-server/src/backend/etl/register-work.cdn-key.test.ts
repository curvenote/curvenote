// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { resolveEtlRegisterDecision } from './register-work.server.js';

describe('resolveEtlRegisterDecision', () => {
  const parent = 'Current_Content/May_2024/10.1101/2024.05.01.123456';
  const updated = `${parent}/_updated_versions/2026-06-10T12-00-00Z`;
  const other = 'Current_Content/May_2024/10.1101/2024.05.01.999999';

  test('skips when work already has incoming cdn_key', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        taggedCdnKey: parent,
        workAlreadyHasIncomingCdnKey: true,
      }),
    ).toEqual({ action: 'skip', reason: 'cdn_key_already_registered' });
  });

  test('permits retagging when pipeline sets allow_retagging', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        articleCdnPrefix: parent,
        taggedCdnKey: parent,
        allowRetagging: true,
      }),
    ).toEqual({ action: 'create' });
  });

  test('skips duplicate DOI without allow_retagging', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        articleCdnPrefix: updated,
        taggedCdnKey: other,
      }),
    ).toEqual({ action: 'skip', reason: 'retagging_not_allowed' });
  });

  test('skips swap-back to parent when tag is on updated tree (no allow flag)', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
        taggedCdnKey: updated,
      }),
    ).toEqual({ action: 'skip', reason: 'retagging_not_allowed' });
  });

  test('creates on first registration', () => {
    expect(
      resolveEtlRegisterDecision({
        versionTag: 'v1',
      }),
    ).toEqual({ action: 'create' });
  });
});
