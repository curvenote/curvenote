/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi } from 'vitest';
import { formatSiteDTO } from './get.server.js';
import type { Context } from '../../context.server.js';

// Mock the dependencies
vi.mock('../../domains.server', () => ({
  createSiteRootUrl: vi.fn((site) => {
    const domain = site.domains.find((d: any) => d.default) ?? site.domains[0];
    return domain ? `https://${domain.hostname}` : undefined;
  }),
}));

vi.mock('./get.server', () => ({
  formatCollectionSummaryDTO: vi.fn(() => ({ id: 'collection1', name: 'Test Collection' })),
}));

vi.mock('../../format.server', () => ({
  formatFooterLinks: vi.fn(() => []),
  formatSocialLinks: vi.fn(() => []),
}));

// Mock context
const createMockContext = (): Context =>
  ({
    asApiUrl: vi.fn((path: string) => `https://api.example.com/v1${path}`),
    asBaseUrl: vi.fn((path: string) => `https://app.example.com${path}`),
  }) as any;

describe('formatSiteDTO', () => {
  test('should use domain-based URL when site has default domain', () => {
    const ctx = createMockContext();
    const site = {
      id: 'site1',
      name: 'test-site',
      title: 'Test Site',
      private: false,
      restricted: true,
      external: false,
      description: 'Test description',
      default_workflow: 'SIMPLE',
      domains: [
        { id: 'domain1', hostname: 'example.com', default: false },
        { id: 'domain2', hostname: 'journal.example.com', default: true },
      ],
      collections: [],
      metadata: {
        tagline: 'Test tagline',
        logo: 'logo.png',
        logo_dark: 'logo-dark.png',
      },
    };

    const result = formatSiteDTO(ctx, site as any);

    expect(result.url).toBe('https://journal.example.com');
    expect(result.links.html).toBe('https://journal.example.com');
    expect(result.links.self).toBe('https://api.example.com/v1/sites/test-site');
  });

  test('should use first domain when no default is set', () => {
    const ctx = createMockContext();
    const site = {
      id: 'site1',
      name: 'test-site',
      title: 'Test Site',
      private: false,
      restricted: true,
      external: false,
      description: 'Test description',
      default_workflow: 'SIMPLE',
      domains: [
        { id: 'domain1', hostname: 'first.com', default: false },
        { id: 'domain2', hostname: 'second.com', default: false },
      ],
      collections: [],
      metadata: {},
    };

    const result = formatSiteDTO(ctx, site as any);

    expect(result.url).toBe('https://first.com');
    expect(result.links.html).toBe('https://first.com');
  });

  test('should return undefined URLs when site has no domains', () => {
    const ctx = createMockContext();
    const site = {
      id: 'site1',
      name: 'test-site',
      title: 'Test Site',
      private: false,
      restricted: true,
      external: false,
      description: 'Test description',
      default_workflow: 'SIMPLE',
      domains: [],
      collections: [],
      metadata: {},
    };

    const result = formatSiteDTO(ctx, site as any);

    expect(result.url).toBeUndefined();
    expect(result.links.html).toBeUndefined();
    expect(result.links.self).toBe('https://api.example.com/v1/sites/test-site');
  });

  test('should preserve API URLs for API resources', () => {
    const ctx = createMockContext();
    const site = {
      id: 'site1',
      name: 'test-site',
      title: 'Test Site',
      private: false,
      restricted: true,
      external: false,
      description: 'Test description',
      default_workflow: 'SIMPLE',
      domains: [{ id: 'domain1', hostname: 'journal.com', default: true }],
      collections: [],
      metadata: {},
    };

    const result = formatSiteDTO(ctx, site as any);

    // Domain-based URLs for site content
    expect(result.url).toBe('https://journal.com');
    expect(result.links.html).toBe('https://journal.com');

    // API URLs for API resources
    expect(result.links.self).toBe('https://api.example.com/v1/sites/test-site');
    expect(result.links.collections).toBe('https://api.example.com/v1/sites/test-site/collections');
    expect(result.links.works).toBe('https://api.example.com/v1/sites/test-site/works');
  });
});
