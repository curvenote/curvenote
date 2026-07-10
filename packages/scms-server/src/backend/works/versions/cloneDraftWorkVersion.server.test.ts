// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPrismaClient = vi.fn();
const mockUuidSequence = vi.fn();

vi.mock('uuidv7', () => ({
  uuidv7: () => mockUuidSequence(),
}));

vi.mock('../../prisma.server.js', () => ({
  getPrismaClient: () => mockGetPrismaClient(),
}));

vi.mock('../../storage/index.js', () => ({
  StorageBackend: class MockStorageBackend {
    cdnFromKnownBucket() {
      return 'cdn://prv';
    }
  },
  KnownBuckets: { prv: 'prv', tmp: 'tmp', pub: 'pub' },
}));

import {
  cloneDraftWorkVersionFromSource,
  seedDraftMetadataFromSource,
  seedDocumentPreviewCacheFromSource,
} from './cloneDraftWorkVersion.server.js';

const ctx = {
  user: { id: 'user-1' },
} as never;

const sourceVersion = {
  id: 'wv-source',
  work_id: 'work-1',
  title: 'Source title',
  description: 'Source description',
  authors: ['Author A'],
  author_details: [{ name: 'Author A' }],
  contains: ['files'],
  metadata: { checks: { enabled: ['x'] }, files: { a: { path: 'old-key/a.pdf' } } },
  cdn: 'cdn://prv',
  cdn_key: 'old-key',
  thumbnail: 'thumb-key',
  doi: '10.1234/source',
};

function createTransactionClient(overrides?: {
  source?: typeof sourceVersion | null;
  work?: { contains: string[]; versions: { contains: string[] }[] } | null;
}) {
  const workUpdate = vi.fn().mockResolvedValue({});
  const activityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

  const tx = {
    workVersion: {
      findFirst: vi.fn(async () => {
        if (overrides && 'source' in overrides) return overrides.source;
        return sourceVersion;
      }),
    },
    work: {
      findUnique: vi.fn(async () => {
        if (overrides && 'work' in overrides) return overrides.work;
        return {
          contains: ['article'],
          versions: [{ contains: ['files'] }],
        };
      }),
      update: workUpdate,
    },
    object: {
      findUnique: vi.fn(async () => null),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    activity: {
      create: activityCreate,
    },
  };

  return { tx, workUpdate, activityCreate };
}

describe('cloneDraftWorkVersionFromSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let uuidCounter = 0;
    mockUuidSequence.mockImplementation(() => {
      uuidCounter += 1;
      return `uuid-${uuidCounter}`;
    });
  });

  it('creates a draft version, updates work contains, and records activity', async () => {
    const { tx, workUpdate, activityCreate } = createTransactionClient();
    mockGetPrismaClient.mockResolvedValue({
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    const result = await cloneDraftWorkVersionFromSource(ctx, {
      workId: 'work-1',
      sourceWorkVersionId: 'wv-source',
      source: 'work-details',
    });

    expect(result).toEqual({ workId: 'work-1', workVersionId: 'uuid-1' });
    expect(tx.workVersion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wv-source', work_id: 'work-1' },
    });
    expect(workUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'work-1' },
        data: expect.objectContaining({
          versions: {
            create: [
              expect.objectContaining({
                id: 'uuid-1',
                cdn_key: 'uuid-2',
                draft: true,
                doi: null,
                title: 'Source title',
                thumbnail: 'thumb-key',
                metadata: seedDraftMetadataFromSource(sourceVersion.metadata),
              }),
            ],
          },
        }),
      }),
    );
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activity_type: 'DRAFT_WORK_VERSION_STARTED',
        activity_by: { connect: { id: 'user-1' } },
        work: { connect: { id: 'work-1' } },
        work_version: { connect: { id: 'uuid-1' } },
      }),
      select: { id: true },
    });
  });

  it('uses a custom activity type when provided', async () => {
    const { tx, activityCreate } = createTransactionClient();
    mockGetPrismaClient.mockResolvedValue({
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    await cloneDraftWorkVersionFromSource(ctx, {
      workId: 'work-1',
      sourceWorkVersionId: 'wv-source',
      activityType: 'WORK_VERSION_ADDED',
    });

    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activity_type: 'WORK_VERSION_ADDED',
      }),
      select: { id: true },
    });
  });

  it('throws 404 when source work version is missing', async () => {
    const { tx } = createTransactionClient({ source: null });
    mockGetPrismaClient.mockResolvedValue({
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    await expect(
      cloneDraftWorkVersionFromSource(ctx, {
        workId: 'work-1',
        sourceWorkVersionId: 'missing',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 404 when work is missing', async () => {
    const { tx } = createTransactionClient({ work: null });
    mockGetPrismaClient.mockResolvedValue({
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    await expect(
      cloneDraftWorkVersionFromSource(ctx, {
        workId: 'work-1',
        sourceWorkVersionId: 'wv-source',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('seedDraftMetadataFromSource', () => {
  it('shallow-copies metadata and resets checks', () => {
    const result = seedDraftMetadataFromSource({
      files: { a: { path: 'k/a.pdf' } },
      license: 'CC-BY',
      'frontmatter.myst': { title: 'T' },
      'frontmatter.myst.source': 'md5-a',
      'upload.analysis': { sourceSignature: 'md5-a' },
    });

    expect(result.files).toEqual({ a: { path: 'k/a.pdf' } });
    expect(result.license).toBe('CC-BY');
    expect(result['frontmatter.myst']).toEqual({ title: 'T' });
    expect(result['frontmatter.myst.source']).toBe('md5-a');
    expect(result['upload.analysis']).toEqual({ sourceSignature: 'md5-a' });
    expect(result.checks).toEqual({ enabled: [] });
  });

  it('resets pmc preview flags when pmc is present', () => {
    const result = seedDraftMetadataFromSource({
      pmc: {
        previewed: true,
        confirmed: true,
        journalName: 'Nature Methods',
        doiSuccess: true,
        title: 'Example article',
      },
    });

    expect(result.pmc).toEqual({
      previewed: false,
      confirmed: false,
      journalName: 'Nature Methods',
      doiSuccess: true,
      title: 'Example article',
    });
  });

  it('handles absent optional keys', () => {
    expect(seedDraftMetadataFromSource(null)).toEqual({ checks: { enabled: [] } });
    expect(seedDraftMetadataFromSource(undefined)).toEqual({ checks: { enabled: [] } });
    expect(seedDraftMetadataFromSource('bad')).toEqual({ checks: { enabled: [] } });
  });

  it('does not add pmc when source has no pmc object', () => {
    expect(seedDraftMetadataFromSource({ title: 'x' })).not.toHaveProperty('pmc');
  });
});

describe('seedDocumentPreviewCacheFromSource', () => {
  it('no-ops when metadata has no preview candidates', async () => {
    const tx = {
      object: { findUnique: vi.fn(), createMany: vi.fn() },
    } as any;

    const count = await seedDocumentPreviewCacheFromSource(tx, {
      sourceWorkVersionId: 'src',
      targetWorkVersionId: 'tgt',
      metadata: {},
    });

    expect(count).toBe(0);
    expect(tx.object.findUnique).not.toHaveBeenCalled();
  });

  it('copies source object rows to target ids', async () => {
    const previewData = { ast: {}, figures: [] };
    const tx = {
      object: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === 'docx:preview:v3:src:md5-a') {
            return { data: previewData };
          }
          return null;
        }),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
    } as any;

    const count = await seedDocumentPreviewCacheFromSource(tx, {
      sourceWorkVersionId: 'src',
      targetWorkVersionId: 'tgt',
      metadata: {
        files: {
          a: { path: 'a.pdf', type: 'application/pdf', md5: 'md5-a' },
        },
      },
      createdById: 'user-1',
    });

    expect(count).toBe(1);
    expect(tx.object.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: 'docx:preview:v3:tgt:md5-a',
          type: 'docx:preview:v3:tgt:md5-a',
          data: previewData,
          created_by_id: 'user-1',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('skips when source cache row is missing', async () => {
    const tx = {
      object: {
        findUnique: vi.fn(async () => null),
        createMany: vi.fn(),
      },
    } as any;

    const count = await seedDocumentPreviewCacheFromSource(tx, {
      sourceWorkVersionId: 'src',
      targetWorkVersionId: 'tgt',
      metadata: {
        files: {
          a: { path: 'a.pdf', type: 'application/pdf', md5: 'md5-a' },
        },
      },
    });

    expect(count).toBe(0);
    expect(tx.object.createMany).not.toHaveBeenCalled();
  });
});
