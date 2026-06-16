/* eslint-disable @typescript-eslint/consistent-type-imports */
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SiteContext } from '@curvenote/scms-server';

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@curvenote/scms-server')>();
  return {
    ...actual,
    getPrismaClient: vi.fn(),
    getConfiguredWorkflow: vi.fn(() => ({
      states: {
        PUBLISHED: { label: 'Published', tags: ['end'] },
        IN_REVIEW: { label: 'In review' },
      },
    })),
  };
});

const ctx = {
  site: { id: 'site-a' },
  $config: {},
} as SiteContext;

describe('dbLoadSubmissionVersionsTimeline', () => {
  let mockPrisma: {
    submission: { findFirst: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma = {
      submission: { findFirst: vi.fn() },
    };
    const { getPrismaClient } = await import('@curvenote/scms-server');
    vi.mocked(getPrismaClient).mockResolvedValue(mockPrisma as never);
  });

  it('returns null when the submission is not on the site', async () => {
    const { dbLoadSubmissionVersionsTimeline } = await import('./db.server.js');
    mockPrisma.submission.findFirst.mockResolvedValue(null);

    const result = await dbLoadSubmissionVersionsTimeline(ctx, 'sub-missing');

    expect(result).toBeNull();
  });

  it('returns versions newest-first with tag and status labels', async () => {
    const { dbLoadSubmissionVersionsTimeline } = await import('./db.server.js');
    mockPrisma.submission.findFirst.mockResolvedValue({
      collection: { workflow: 'SIMPLE' },
      versions: [
        {
          id: 'v-new',
          date_created: '2026-05-02T00:00:00.000Z',
          date_modified: '2026-05-02T12:00:00.000Z',
          date_published: '2026-05-03T00:00:00.000Z',
          status: 'PUBLISHED',
          tags: ['v2'],
        },
        {
          id: 'v-old',
          date_created: '2026-05-01T00:00:00.000Z',
          date_modified: '2026-05-01T00:00:00.000Z',
          date_published: null,
          status: 'IN_REVIEW',
          tags: ['v1'],
        },
      ],
    });

    const result = await dbLoadSubmissionVersionsTimeline(ctx, 'sub-1');

    expect(result).toEqual([
      {
        id: 'v-new',
        date_created: '2026-05-02T00:00:00.000Z',
        date_modified: '2026-05-02T12:00:00.000Z',
        date_published: '2026-05-03T00:00:00.000Z',
        status: 'PUBLISHED',
        statusLabel: 'Published',
        statusTags: ['end'],
        tag: 'v2',
      },
      {
        id: 'v-old',
        date_created: '2026-05-01T00:00:00.000Z',
        date_modified: '2026-05-01T00:00:00.000Z',
        date_published: undefined,
        status: 'IN_REVIEW',
        statusLabel: 'In review',
        statusTags: undefined,
        tag: 'v1',
      },
    ]);
  });

  it('issues a single tenancy-scoped query with nested versions ordered desc', async () => {
    const { dbLoadSubmissionVersionsTimeline } = await import('./db.server.js');
    mockPrisma.submission.findFirst.mockResolvedValue({
      collection: { workflow: 'SIMPLE' },
      versions: [],
    });

    await dbLoadSubmissionVersionsTimeline(ctx, 'sub-1');

    expect(mockPrisma.submission.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.submission.findFirst).toHaveBeenCalledWith({
      where: { id: 'sub-1', site_id: 'site-a' },
      select: {
        collection: { select: { workflow: true } },
        versions: {
          orderBy: { date_created: 'desc' },
          select: {
            id: true,
            date_created: true,
            date_modified: true,
            date_published: true,
            status: true,
            tags: true,
          },
        },
      },
    });
  });
});
