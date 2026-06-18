/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchPublishedSubmissionVersionId } from './resolve.server.js';

const queryRaw = vi.fn();

vi.mock('../../../../prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    $queryRaw: queryRaw,
  })),
}));

function queryText(callIndex: number): string {
  return String(queryRaw.mock.calls[callIndex][0]);
}

describe('fetchPublishedSubmissionVersionId', () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  test('falls back to slug lookup when a UUID-shaped work id lookup misses', async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'slug-version-id' }]);

    const id = await fetchPublishedSubmissionVersionId(
      'site-id',
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(id).toBe('slug-version-id');
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryText(0)).toContain('FROM "WorkVersion"');
    expect(queryText(1)).toContain('FROM "Slug"');
  });

  test('falls back to work id lookup when a slug-shaped slug lookup misses', async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'work-version-id' }]);

    const id = await fetchPublishedSubmissionVersionId('site-id', 'legacy-work-id');

    expect(id).toBe('work-version-id');
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryText(0)).toContain('FROM "Slug"');
    expect(queryText(1)).toContain('FROM "WorkVersion"');
  });

  test('does not run fallback lookup after preferred lookup succeeds', async () => {
    queryRaw.mockResolvedValueOnce([{ id: 'preferred-version-id' }]);

    const id = await fetchPublishedSubmissionVersionId(
      'site-id',
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(id).toBe('preferred-version-id');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryText(0)).toContain('FROM "WorkVersion"');
  });
});
