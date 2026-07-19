// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { seedArticleDraftMetadataFromSource } from './seedArticleDraftMetadata.server';

describe('seedArticleDraftMetadataFromSource', () => {
  it('keeps frontmatter but drops file-derived metadata', () => {
    const result = seedArticleDraftMetadataFromSource({
      files: { manuscript: { path: 'old-key/doc.docx' } },
      license: 'CC-BY',
      'frontmatter.myst': { title: 'Inherited title', authors: [{ name: 'A' }] },
      'frontmatter.myst.source': 'md5-old',
      'upload.analysis': { sourceSignature: 'md5-old', document: { images: { present: true } } },
      thumbnails: [{ key: 'thumb.webp', sourcePath: 'old-key/doc.docx', md5: 'md5-old' }],
      checks: { enabled: ['text-integrity'] },
    });

    expect(result).not.toHaveProperty('files');
    expect(result).not.toHaveProperty('upload.analysis');
    expect(result).not.toHaveProperty('thumbnails');
    expect(result.license).toBe('CC-BY');
    expect(result['frontmatter.myst']).toEqual({
      title: 'Inherited title',
      authors: [{ name: 'A' }],
    });
    expect(result['frontmatter.myst.source']).toBe('md5-old');
    expect(result.checks).toEqual({ enabled: [] });
  });
});
