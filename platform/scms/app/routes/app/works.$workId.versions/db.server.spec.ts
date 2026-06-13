/* eslint-disable @typescript-eslint/consistent-type-imports */
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@curvenote/scms-server')>();
  return {
    ...actual,
    getPrismaClient: vi.fn(),
  };
});

describe('dbLoadWorkVersionsTimeline', () => {
  let mockPrisma: {
    workVersion: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma = {
      workVersion: { findMany: vi.fn() },
    };
    const { getPrismaClient } = await import('@curvenote/scms-server');
    vi.mocked(getPrismaClient).mockResolvedValue(mockPrisma as never);
  });

  it('returns versions newest-first with draft labels and version numbers', async () => {
    const { dbLoadWorkVersionsTimeline } = await import('./db.server.js');
    mockPrisma.workVersion.findMany.mockResolvedValue([
      {
        id: 'wv-draft',
        date_created: '2026-05-03T00:00:00.000Z',
        date_modified: '2026-05-03T12:00:00.000Z',
        draft: true,
        tags: ['draft-tag'],
      },
      {
        id: 'wv-2',
        date_created: '2026-05-02T00:00:00.000Z',
        date_modified: '2026-05-02T12:00:00.000Z',
        draft: false,
        tags: ['v2'],
      },
      {
        id: 'wv-1',
        date_created: '2026-05-01T00:00:00.000Z',
        date_modified: '2026-05-01T00:00:00.000Z',
        draft: false,
        tags: [],
      },
    ]);

    const result = await dbLoadWorkVersionsTimeline('work-1');

    expect(result).toEqual([
      {
        id: 'wv-draft',
        date_created: '2026-05-03T00:00:00.000Z',
        date_modified: '2026-05-03T12:00:00.000Z',
        draft: true,
        label: 'Draft',
        tag: 'draft-tag',
      },
      {
        id: 'wv-2',
        date_created: '2026-05-02T00:00:00.000Z',
        date_modified: '2026-05-02T12:00:00.000Z',
        draft: false,
        label: 'v2',
        tag: 'v2',
      },
      {
        id: 'wv-1',
        date_created: '2026-05-01T00:00:00.000Z',
        date_modified: '2026-05-01T00:00:00.000Z',
        draft: false,
        label: 'v1',
        tag: undefined,
      },
    ]);
  });
});
