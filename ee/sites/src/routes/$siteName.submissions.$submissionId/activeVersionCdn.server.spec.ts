// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { CurvenoteSiteManifest } from '@curvenote/cdn';
import { cdnManifestHasThumbnail } from './activeVersionCdn.server.js';

describe('cdnManifestHasThumbnail', () => {
  it('detects a site-level thumbnail', () => {
    expect(cdnManifestHasThumbnail({ thumbnail: '/thumb.webp' } as CurvenoteSiteManifest)).toBe(
      true,
    );
  });

  it('detects a project-level thumbnail', () => {
    expect(
      cdnManifestHasThumbnail({
        projects: [{ thumbnail: '/p.webp', pages: [] }],
      } as unknown as CurvenoteSiteManifest),
    ).toBe(true);
  });

  it('detects a page-level thumbnail', () => {
    expect(
      cdnManifestHasThumbnail({
        projects: [{ pages: [{ thumbnail: '/page.webp' }] }],
      } as unknown as CurvenoteSiteManifest),
    ).toBe(true);
  });

  it('is false when no thumbnail fields are set', () => {
    expect(
      cdnManifestHasThumbnail({
        projects: [{ pages: [{ title: 'Text only' }] }],
      } as unknown as CurvenoteSiteManifest),
    ).toBe(false);
    expect(cdnManifestHasThumbnail({} as CurvenoteSiteManifest)).toBe(false);
  });
});
