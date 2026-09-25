/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MYST_WEB_SOURCES_PREFIX,
  filterFilesToMystWebPackage,
  isSafeMystWebPackageRelativePath,
  mystWebPackageRelativePath,
  resolveMystWebSourcesPrefix,
} from './mystWebPackageFiles.js';

describe('mystWebPackageFiles', () => {
  const cdnKey = 'wv-abc';
  const prefix = DEFAULT_MYST_WEB_SOURCES_PREFIX;

  it('resolves sourcesPrefix from foundry.publish or default', () => {
    expect(resolveMystWebSourcesPrefix(null)).toBe(prefix);
    expect(resolveMystWebSourcesPrefix({})).toBe(prefix);
    expect(
      resolveMystWebSourcesPrefix({ foundry: { publish: { sourcesPrefix: 'sources/custom/' } } }),
    ).toBe('sources/custom');
  });

  it('maps only paths under the package prefix', () => {
    expect(mystWebPackageRelativePath(`${cdnKey}/${prefix}/manuscript.md`, prefix, cdnKey)).toBe(
      'manuscript.md',
    );
    expect(mystWebPackageRelativePath(`${prefix}/media/fig.png`, prefix, cdnKey)).toBe(
      'media/fig.png',
    );
    expect(
      mystWebPackageRelativePath(`${cdnKey}/uploads/manuscript.md`, prefix, cdnKey),
    ).toBeNull();
    expect(mystWebPackageRelativePath('media/fig.png', prefix, cdnKey)).toBeNull();
    expect(mystWebPackageRelativePath('manuscript.md', prefix, cdnKey)).toBeNull();
  });

  it('rejects a sourcesPrefix hit that is not the path prefix', () => {
    expect(
      mystWebPackageRelativePath(
        `${cdnKey}/uploads/archive/${prefix}/private.docx`,
        prefix,
        cdnKey,
      ),
    ).toBeNull();
    expect(
      mystWebPackageRelativePath(`${cdnKey}/notsources/myst/secret.md`, prefix, cdnKey),
    ).toBeNull();
    expect(
      mystWebPackageRelativePath(`prefix-${cdnKey}/${prefix}/file.md`, prefix, cdnKey),
    ).toBeNull();
    expect(mystWebPackageRelativePath(`other-key/${prefix}/leak.bin`, prefix, cdnKey)).toBeNull();
  });

  it('rejects unsafe relative paths', () => {
    expect(isSafeMystWebPackageRelativePath('manuscript.md')).toBe(true);
    expect(isSafeMystWebPackageRelativePath('media/a.png')).toBe(true);
    expect(isSafeMystWebPackageRelativePath('../etc/passwd')).toBe(false);
    expect(isSafeMystWebPackageRelativePath('media/../../x')).toBe(false);
    expect(isSafeMystWebPackageRelativePath('/abs')).toBe(false);
  });

  it('filters a file map to package entries only', () => {
    const files = {
      [`${cdnKey}/${prefix}/manuscript.md`]: {
        path: `${cdnKey}/${prefix}/manuscript.md`,
        name: 'manuscript.md',
      },
      [`${cdnKey}/${prefix}/myst.yml`]: { path: `${cdnKey}/${prefix}/myst.yml`, name: 'myst.yml' },
      [`${cdnKey}/docx/media/fig.png`]: {
        path: `${cdnKey}/docx/media/fig.png`,
        name: 'fig.png',
      },
      other: { path: 'manuscript.md', name: 'manuscript.md' },
      escape: { path: `${prefix}/../../evil`, name: 'evil' },
      nested: {
        path: `${cdnKey}/uploads/archive/${prefix}/private.docx`,
        name: 'private.docx',
      },
      midSegment: { path: `${cdnKey}/notsources/myst/secret.md`, name: 'secret.md' },
    };
    const filtered = filterFilesToMystWebPackage(files, prefix, cdnKey);
    expect(Object.keys(filtered).sort()).toEqual(
      [`${cdnKey}/${prefix}/manuscript.md`, `${cdnKey}/${prefix}/myst.yml`].sort(),
    );
  });
});
