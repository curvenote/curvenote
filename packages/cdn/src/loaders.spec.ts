// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fetch from 'node-fetch';
import { SourceFileKind } from 'myst-spec-ext';
import {
  getJournal,
  lookupJournal,
  getCdnLocation,
  getCdnBaseUrl,
  getWork,
  getWorkByDOI,
  getWorks,
  getConfig,
  getObjectsInv,
  getMystXrefJson,
  getMystSearchJson,
  getPage,
  getThumbnailBuffer,
} from './loaders.js';
import type { HostSpec, SiteDTO, WorkDTO, SiteWorkListingDTO } from '@curvenote/common';
import type { SiteManifest } from 'myst-config';
import type { PageLoader } from './types.js';

const migrateMock = vi.fn();

vi.mock('node-fetch');
vi.mock('myst-migrate', () => ({
  migrate: (...args: any[]) => migrateMock(...args),
}));

describe('CDN Loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    migrateMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getJournal', () => {
    it('should fetch journal by site name', async () => {
      const mockJournal: SiteDTO = {
        name: 'test-journal',
        links: { html: 'https://test.example.com' },
      } as SiteDTO;

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJournal,
      });

      const journal = await getJournal('test-journal');
      expect(journal.name).toBe('test-journal');
      expect(journal.links.html).toBe('https://test.example.com');
    });
  });

  describe('lookupJournal', () => {
    it('should lookup journal by hostname', async () => {
      const mockJournal: SiteDTO = {
        name: 'test-journal',
        links: { html: 'https://test.example.com' },
      } as SiteDTO;

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockJournal] }),
      });

      const journal = await lookupJournal('test.example.com');
      expect(journal.name).toBe('test-journal');
    });
  });

  describe('getCdnLocation', () => {
    it('should return host spec when host is already a HostSpec', async () => {
      const hostSpec: HostSpec = { cdn: 'https://cdn.example.com', key: 'test-key' };
      const result = await getCdnLocation(hostSpec);
      expect(result).toEqual(hostSpec);
    });

    it('should lookup CDN path for string hostname', async () => {
      (fetch as any).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ cdn: 'test-cdn-key' }),
      });

      const result = await getCdnLocation('example.com');
      expect(result).toEqual({ cdn: 'https://cdn.curvenote.com/', key: 'test-cdn-key' });
    });

    it('should throw when CDN path not found', async () => {
      (fetch as any).mockResolvedValueOnce({
        status: 404,
      });

      await expect(getCdnLocation('nonexistent.com')).rejects.toThrow();
    });
  });

  describe('getCdnBaseUrl', () => {
    it('should return base URL for HostSpec', async () => {
      const hostSpec: HostSpec = { cdn: 'https://cdn.example.com/', key: 'test.key' };
      const result = await getCdnBaseUrl(hostSpec);
      expect(result).toBe('https://cdn.example.com/test/key/');
    });

    it('should lookup and construct base URL for string hostname', async () => {
      (fetch as any).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ cdn: 'test.key' }),
      });

      const result = await getCdnBaseUrl('example.com');
      expect(result).toBe('https://cdn.curvenote.com/test/key/');
    });
  });

  describe('getWork', () => {
    it('should fetch work by workId', async () => {
      const mockWork: WorkDTO = {
        id: 'work-123',
        title: 'Test Work',
      } as WorkDTO;

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWork,
      });

      const work = await getWork('work-123');
      expect(work.id).toBe('work-123');
      expect(work.title).toBe('Test Work');
    });
  });

  describe('getWorkByDOI', () => {
    it('should fetch work by DOI', async () => {
      const mockWork: WorkDTO = {
        id: 'work-123',
        title: 'Test Work',
        doi: '10.1234/test',
      } as WorkDTO;

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWork,
      });

      const work = await getWorkByDOI('10.1234/test');
      expect(work.doi).toBe('10.1234/test');
    });
  });

  describe('getWorks', () => {
    it('should fetch works for a site', async () => {
      const mockWorks: SiteWorkListingDTO = {
        items: [],
        total: 0,
        links: {
          self: 'https://api.example.com/sites/test-site/works',
          site: 'https://api.example.com/sites/test-site',
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorks,
      });

      const works = await getWorks('test-site');
      expect(works).toBeDefined();
      expect(works.items).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('should fetch config with bypass option', async () => {
      const mockConfig: SiteManifest = {
        version: 1,
        myst: 'v1',
        title: 'Test Site',
        projects: [],
      } as SiteManifest;

      (fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockConfig,
      });

      const config = await getConfig('example.com', { bypass: 'https://bypass.example.com' });
      expect(config.title).toBe('Test Site');
      expect(config.id).toBe('bypass');
    });

    it('should fetch config from CDN', async () => {
      const mockConfig: SiteManifest = {
        version: 1,
        myst: 'v1',
        title: 'Test Site',
        projects: [],
      } as SiteManifest;

      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockConfig,
        });

      const config = await getConfig('example.com');
      expect(config.title).toBe('Test Site');
    });
  });

  describe('getObjectsInv', () => {
    it('should fetch objects.inv file', async () => {
      const mockBuffer = new ArrayBuffer(8);

      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          arrayBuffer: async () => mockBuffer,
        });

      const buffer = await getObjectsInv('example.com');
      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should return undefined for 404', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 404,
        });

      const buffer = await getObjectsInv('example.com');
      expect(buffer).toBeUndefined();
    });
  });

  describe('getMystXrefJson', () => {
    it('should fetch myst.xref.json file', async () => {
      const mockXrefs = {
        references: [{ id: 'ref1', data: '/content/test.md' }],
      };

      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockXrefs,
        });

      const xrefs = await getMystXrefJson('example.com', '/mount');
      expect(xrefs).toBeDefined();
      expect(xrefs?.references[0].data).toBe('/mount/test.md');
    });

    it('should return null for 404', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 404,
        });

      const xrefs = await getMystXrefJson('example.com');
      expect(xrefs).toBeNull();
    });

    it.only('should work with bypass option', async () => {
      const mockXrefs = {
        references: [],
      };

      (fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockXrefs,
      });

      const xrefs = await getMystXrefJson('example.com', '', {
        bypass: 'https://bypass.example.com',
      });
      expect(xrefs).toBeDefined();
    });
  });

  describe('getMystSearchJson', () => {
    it('should fetch myst.search.json file', async () => {
      const mockSearch = {
        index: [],
      };

      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockSearch,
        });

      const search = await getMystSearchJson('example.com');
      expect(search).toBeDefined();
      expect(search?.index).toEqual([]);
    });

    it('should return null for 404', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 404,
        });

      const search = await getMystSearchJson('example.com');
      expect(search).toBeNull();
    });
  });

  describe('getPage', () => {
    it('should fetch page data', async () => {
      const mockConfig: SiteManifest = {
        version: 1,
        myst: 'v1',
        id: 'test-site',
        title: 'Test Site',
        projects: [
          {
            slug: 'test-project',
            title: 'Test Project',
            index: 'index',
            pages: [{ slug: 'page1', title: 'Page 1' }],
          },
        ],
      } as SiteManifest;

      const mockPageLoader: PageLoader = {
        slug: 'index',
        kind: SourceFileKind.Article,
        location: 'index.md',
        sha256: 'abc123',
        domain: 'example.com',
        project: 'test-project',
        frontmatter: {},
        mdast: { type: 'root', children: [] },
        references: {},
      };

      // Mock sequence:
      // 1. getCdnLocation(host) - first call
      // 2. getCdnBaseUrl(host) -> getCdnLocation(host) - second call
      // 3. getConfig(location) - uses location directly, no fetch
      // 4. getData -> fetch page content
      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockPageLoader,
        });

      const page = await getPage('example.com', { slug: 'index', project: 'test-project' });
      expect(page).toBeDefined();
      expect(page?.slug).toBe('index');
    });

    it('should migrate page data to mystSpecVersion 3', async () => {
      const mockConfig: SiteManifest = {
        version: 1,
        myst: 'v1',
        id: 'test-site',
        title: 'Test Site',
        projects: [
          {
            slug: 'test-project',
            title: 'Test Project',
            index: 'index',
            pages: [{ slug: 'page1', title: 'Page 1' }],
          },
        ],
      } as SiteManifest;

      const mockPageLoader: PageLoader = {
        slug: 'index',
        kind: SourceFileKind.Article,
        location: 'index.md',
        sha256: 'abc123',
        domain: 'example.com',
        project: 'test-project',
        frontmatter: {},
        mdast: { type: 'root', children: [] },
        references: {},
      };

      const migratedPageLoader: PageLoader = {
        ...mockPageLoader,
        version: 3,
      };

      migrateMock.mockResolvedValueOnce(migratedPageLoader);

      // Mock sequence:
      // 1. getCdnLocation(host) - first call
      // 2. getCdnBaseUrl(host) -> getCdnLocation(host) - second call
      // 3. getConfig(location) - uses location directly, no fetch
      // 4. getData -> fetch page content
      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ cdn: 'test.key' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockPageLoader,
        });

      const page = await getPage('example.com', {
        slug: 'index',
        project: 'test-project',
        migrateToMystSpecVersion: 3,
      });

      expect(page).toBeDefined();
      expect(page?.slug).toBe('index');
      expect(migrateMock).toHaveBeenCalledTimes(1);
      expect(migrateMock).toHaveBeenCalledWith({ version: 0, ...mockPageLoader }, { to: 3 });
      expect(page?.version).toBe(3);
    });
  });

  describe('getThumbnailBuffer', () => {
    it('should fetch thumbnail buffer from config thumbnail', async () => {
      const mockConfig: SiteManifest = {
        version: 1,
        myst: 'v1',
        thumbnail: 'https://example.com/thumb.jpg',
        projects: [],
      } as SiteManifest;

      const mockBuffer = new ArrayBuffer(8);

      (fetch as any)
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockConfig,
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          arrayBuffer: async () => mockBuffer,
        });

      const buffer = await getThumbnailBuffer({ cdn: 'https://cdn.example.com', key: 'test' });
      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should return undefined when no thumbnail found', async () => {
      const mockConfig: SiteManifest = {
        version: 1,
        myst: 'v1',
        projects: [
          {
            slug: 'test-project',
            title: 'Test Project',
            index: 'index',
            pages: [],
          },
        ],
      } as SiteManifest;

      (fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockConfig,
      });

      const buffer = await getThumbnailBuffer({ cdn: 'https://cdn.example.com', key: 'test' });
      expect(buffer).toBeUndefined();
    });
  });

  describe.skip('Live API tests', () => {
    it('should fetch journal from live API', async () => {
      // These tests require network access and are skipped in the mocked test suite
      // Run them separately if needed
      const journal = await getJournal('physiome');
      expect(journal.name).toBe('physiome');
      expect(journal.links.html).toBe('https://journal.physiomeproject.org');
    });

    it('should lookup journal from live API', async () => {
      const journal = await lookupJournal('proceedings.scipy.org');
      expect(journal.name).toBe('scipy');
      expect(journal.links.html).toBe('https://proceedings.scipy.org');
    });
  });
});
