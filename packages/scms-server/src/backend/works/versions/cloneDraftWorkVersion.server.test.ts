// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import {
  seedDraftMetadataFromSource,
  seedDocumentPreviewCacheFromSource,
} from './cloneDraftWorkVersion.server.js';

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
      pmc: { previewed: true, confirmed: true, journal: 'x' },
    });

    expect(result.pmc).toEqual({
      previewed: false,
      confirmed: false,
      journal: 'x',
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
