/* eslint-disable @typescript-eslint/consistent-type-imports */
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SIMPLE_PUBLIC_WORKFLOW } from '@curvenote/scms-core';

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@curvenote/scms-server')>();
  return {
    ...actual,
    getPrismaClient: vi.fn(),
  };
});

const workflows = { SIMPLE: SIMPLE_PUBLIC_WORKFLOW };

describe('dbLoadWorkVersionsTimeline', () => {
  let mockPrisma: {
    workVersion: { findMany: ReturnType<typeof vi.fn> };
    checkServiceRun: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma = {
      workVersion: { findMany: vi.fn() },
      checkServiceRun: { findMany: vi.fn() },
    };
    const { getPrismaClient } = await import('@curvenote/scms-server');
    vi.mocked(getPrismaClient).mockResolvedValue(mockPrisma as never);
  });

  it('returns versions newest-first with linked submission versions', async () => {
    const { dbLoadWorkVersionsTimeline } = await import('./db.server.js');
    mockPrisma.workVersion.findMany.mockResolvedValue([
      {
        id: 'wv-2',
        date_created: '2026-05-02T00:00:00.000Z',
        date_modified: '2026-05-02T12:00:00.000Z',
        draft: false,
        submissionVersions: [
          {
            id: 'sv-2',
            status: 'PUBLISHED',
            tags: ['v2'],
            date_published: '2026-05-02T08:00:00.000Z',
            submission: {
              id: 'sub-1',
              site: {
                name: 'demo',
                title: 'Demo Site',
                metadata: { logo: 'https://example.com/logo.png' },
              },
              collection: { workflow: 'SIMPLE' },
            },
          },
        ],
      },
      {
        id: 'wv-1',
        date_created: '2026-05-01T00:00:00.000Z',
        date_modified: '2026-05-01T00:00:00.000Z',
        draft: false,
        submissionVersions: [],
      },
    ]);
    mockPrisma.checkServiceRun.findMany.mockResolvedValue([
      {
        id: 'run-2',
        kind: 'service-a',
        date_created: '2026-05-02T10:00:00.000Z',
        date_modified: '2026-05-02T10:05:00.000Z',
        data: { serviceData: { status: 'latest' } },
        work_version_id: 'wv-2',
        created_by_id: null,
      },
      {
        id: 'run-1',
        kind: 'service-a',
        date_created: '2026-05-02T09:00:00.000Z',
        date_modified: '2026-05-02T09:05:00.000Z',
        data: { serviceData: { status: 'older' } },
        work_version_id: 'wv-2',
        created_by_id: null,
      },
      {
        id: 'run-3',
        kind: 'service-b',
        date_created: '2026-05-01T10:00:00.000Z',
        date_modified: '2026-05-01T10:05:00.000Z',
        data: { serviceData: { status: 'text' } },
        work_version_id: 'wv-1',
        created_by_id: null,
      },
    ]);

    const result = await dbLoadWorkVersionsTimeline('work-1', workflows);

    expect(result).toEqual([
      {
        id: 'wv-2',
        date_created: '2026-05-02T00:00:00.000Z',
        date_modified: '2026-05-02T12:00:00.000Z',
        draft: false,
        submissionVersions: [
          {
            id: 'sv-2',
            submissionId: 'sub-1',
            status: 'PUBLISHED',
            statusLabel: 'Published',
            date_published: '2026-05-02T08:00:00.000Z',
            tag: 'v2',
            statusTags: ['ok', 'end'],
            site: {
              name: 'demo',
              title: 'Demo Site',
              logo: 'https://example.com/logo.png',
            },
          },
        ],
        checkRuns: [
          {
            id: 'run-2',
            work_version_id: 'wv-2',
            kind: 'service-a',
            date_created: '2026-05-02T10:00:00.000Z',
            date_modified: '2026-05-02T10:05:00.000Z',
            data: { serviceData: { status: 'latest' } },
          },
        ],
      },
      {
        id: 'wv-1',
        date_created: '2026-05-01T00:00:00.000Z',
        date_modified: '2026-05-01T00:00:00.000Z',
        draft: false,
        submissionVersions: [],
        checkRuns: [
          {
            id: 'run-3',
            work_version_id: 'wv-1',
            kind: 'service-b',
            date_created: '2026-05-01T10:00:00.000Z',
            date_modified: '2026-05-01T10:05:00.000Z',
            data: { serviceData: { status: 'text' } },
          },
        ],
      },
    ]);
  });
});
