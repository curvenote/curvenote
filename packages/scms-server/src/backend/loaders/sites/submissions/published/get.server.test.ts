/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi } from 'vitest';
import { formatSiteWorkDTO } from './get.server.js';
import type { SiteContext } from '../../../../context.site.server.js';

// Mock the dependencies
vi.mock('../../../../domains.server', () => ({
  createArticleUrl: vi.fn((site, workId) => {
    const domain = site.domains.find((d: any) => d.default) ?? site.domains[0];
    return domain ? `https://${domain.hostname}/articles/${workId}` : undefined;
  }),
}));

vi.mock('../../../../sign.private.server', () => ({
  signPrivateUrls: vi.fn(() => ({
    host: { query: 'test-query' },
    thumbnail: 'https://cdn.example.com/thumbnail.jpg',
    social: 'https://cdn.example.com/social.jpg',
    config: 'https://cdn.example.com/config.json',
  })),
}));

vi.mock('../../kinds/get.server', () => ({
  formatSubmissionKindSummaryDTO: vi.fn(() => ({ id: 'kind1', name: 'Article' })),
}));

vi.mock('../../get.server', () => ({
  formatCollectionSummaryDTO: vi.fn(() => ({ id: 'collection1', name: 'Articles' })),
}));

vi.mock('@curvenote/common', () => ({
  formatDate: vi.fn((date) => date),
}));

// Mock SiteContext
const createMockSiteContext = (siteDomains: any[] = []): SiteContext =>
  ({
    site: {
      id: 'site1',
      name: 'test-site',
      domains: siteDomains,
    },
    asApiUrl: vi.fn((path: string) => `https://api.example.com/v1${path}`),
    asBaseUrl: vi.fn((path: string) => `https://app.example.com${path}`),
  }) as any;

describe('formatSiteWorkDTO', () => {
  test('should include HTML link with domain when site has default domain', () => {
    const ctx = createMockSiteContext([
      { id: 'domain1', hostname: 'first.com', default: false },
      { id: 'domain2', hostname: 'journal.com', default: true },
    ]);

    const dbo = {
      id: 'version1',
      work_version: {
        id: 'work-version-1',
        work_id: 'work-123',
        title: 'Test Article',
        description: 'Test description',
        authors: [{ name: 'John Doe' }],
        date_created: '2024-01-01',
        canonical: true,
        cdn: 'https://cdn.example.com/',
        cdn_key: 'test-key',
        doi: '10.1234/test',
      },
      submission: {
        kind: { id: 'kind1', name: 'Article' },
        collection: { id: 'collection1', name: 'Articles' },
        slugs: [{ slug: 'test-slug', primary: true }],
        work: { key: 'test-key', doi: null },
        date_published: '2024-01-01',
      },
    };

    const result = formatSiteWorkDTO(ctx, dbo as any);

    // Should include HTML link using domain
    expect(result.links.html).toBe('https://journal.com/articles/work-123');

    // Should preserve API links
    expect(result.links.self).toBe(
      'https://api.example.com/v1/sites/test-site/works/work-123/versions/work-version-1',
    );
    expect(result.links.site).toBe('https://api.example.com/v1/sites/test-site');
    expect(result.links.work).toBe('https://api.example.com/v1/works/work-123');

    // Should include CDN links (from mock)
    expect(result.links.thumbnail).toBe('https://cdn.example.com/thumbnail.jpg');
    expect(result.links.social).toBe('https://cdn.example.com/social.jpg');
    expect(result.links.config).toBe('https://cdn.example.com/config.json');
  });

  test('should use first domain when no default is set', () => {
    const ctx = createMockSiteContext([
      { id: 'domain1', hostname: 'first.com', default: false },
      { id: 'domain2', hostname: 'second.com', default: false },
    ]);

    const dbo = {
      id: 'version1',
      work_version: {
        id: 'work-version-1',
        work_id: 'work-123',
        title: 'Test Article',
        description: 'Test description',
        authors: [{ name: 'John Doe' }],
        date_created: '2024-01-01',
        canonical: false,
        cdn: null,
        cdn_key: null,
        doi: null,
      },
      submission: {
        kind: { id: 'kind1', name: 'Article' },
        collection: { id: 'collection1', name: 'Articles' },
        slugs: [],
        work: { key: null, doi: null },
        date_published: '2024-01-01',
      },
    };

    const result = formatSiteWorkDTO(ctx, dbo as any);

    expect(result.links.html).toBe('https://first.com/articles/work-123');
  });

  test('should return undefined HTML link when site has no domains', () => {
    const ctx = createMockSiteContext([]); // No domains

    const dbo = {
      id: 'version1',
      work_version: {
        id: 'work-version-1',
        work_id: 'work-123',
        title: 'Test Article',
        description: 'Test description',
        authors: [{ name: 'John Doe' }],
        date_created: '2024-01-01',
        canonical: false,
        cdn: null,
        cdn_key: null,
        doi: null,
      },
      submission: {
        kind: { id: 'kind1', name: 'Article' },
        collection: { id: 'collection1', name: 'Articles' },
        slugs: [],
        work: { key: null, doi: null },
        date_published: '2024-01-01',
      },
    };

    const result = formatSiteWorkDTO(ctx, dbo as any);

    expect(result.links.html).toBeUndefined();

    // API links should still work
    expect(result.links.self).toBe(
      'https://api.example.com/v1/sites/test-site/works/work-123/versions/work-version-1',
    );
  });

  test('should handle work with DOI', () => {
    const ctx = createMockSiteContext([{ id: 'domain1', hostname: 'journal.com', default: true }]);

    const dbo = {
      id: 'version1',
      work_version: {
        id: 'work-version-1',
        work_id: 'work-123',
        title: 'Test Article',
        description: 'Test description',
        authors: [{ name: 'John Doe' }],
        date_created: '2024-01-01',
        canonical: true,
        cdn: null,
        cdn_key: null,
        doi: '10.1234/test',
      },
      submission: {
        kind: { id: 'kind1', name: 'Article' },
        collection: { id: 'collection1', name: 'Articles' },
        slugs: [],
        work: { key: null, doi: null },
        date_published: '2024-01-01',
      },
    };

    const result = formatSiteWorkDTO(ctx, dbo as any);

    expect(result.doi).toBe('10.1234/test');
    expect(result.links.doi).toBe('https://doi.org/10.1234/test');
    expect(result.links.html).toBe('https://journal.com/articles/work-123');
  });
});
