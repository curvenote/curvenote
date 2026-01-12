/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import {
  getPrimaryDomain,
  createSiteUrl,
  createArticleUrl,
  createPreviewUrl,
  createSiteRootUrl,
} from './domains.server.js';

// Mock site type based on the actual structure
type MockSiteDBO = {
  id: string;
  name: string;
  domains: Array<{
    id: string;
    hostname: string;
    default: boolean;
  }>;
};

describe('Domain Server Utilities', () => {
  describe('getPrimaryDomain', () => {
    test('should return default domain when one is marked as default', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [
          { id: 'domain1', hostname: 'example.com', default: false },
          { id: 'domain2', hostname: 'default.com', default: true },
          { id: 'domain3', hostname: 'other.com', default: false },
        ],
      };

      const result = getPrimaryDomain(site as any);
      expect(result?.hostname).toBe('default.com');
      expect(result?.default).toBe(true);
    });

    test('should return first domain when no default is marked', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [
          { id: 'domain1', hostname: 'first.com', default: false },
          { id: 'domain2', hostname: 'second.com', default: false },
        ],
      };

      const result = getPrimaryDomain(site as any);
      expect(result?.hostname).toBe('first.com');
    });

    test('should return undefined when no domains exist', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [],
      };

      const result = getPrimaryDomain(site as any);
      expect(result).toBeUndefined();
    });

    test('should return single domain even if not marked as default', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [{ id: 'domain1', hostname: 'single.com', default: false }],
      };

      const result = getPrimaryDomain(site as any);
      expect(result?.hostname).toBe('single.com');
    });
  });

  describe('createSiteUrl', () => {
    test('should create proper URL with domain and path', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [{ id: 'domain1', hostname: 'example.com', default: true }],
      };

      const result = createSiteUrl(site as any, '/articles/123');
      expect(result).toBe('https://example.com/articles/123');
    });

    test('should return undefined when no domains exist', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [],
      };

      const result = createSiteUrl(site as any, '/articles/123');
      expect(result).toBeUndefined();
    });

    test('should handle empty path', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [{ id: 'domain1', hostname: 'example.com', default: true }],
      };

      const result = createSiteUrl(site as any, '');
      expect(result).toBe('https://example.com');
    });
  });

  describe('createArticleUrl', () => {
    test('should create proper article URL', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [{ id: 'domain1', hostname: 'journal.com', default: true }],
      };

      const result = createArticleUrl(site as any, 'work-123');
      expect(result).toBe('https://journal.com/articles/work-123');
    });

    test('should return undefined when no domains exist', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [],
      };

      const result = createArticleUrl(site as any, 'work-123');
      expect(result).toBeUndefined();
    });
  });

  describe('createPreviewUrl', () => {
    test('should create proper preview URL with signature', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [{ id: 'domain1', hostname: 'journal.com', default: true }],
      };

      const result = createPreviewUrl(site as any, 'version-456', 'signature789');
      expect(result).toBe('https://journal.com/previews/version-456?preview=signature789');
    });

    test('should return undefined when no domains exist', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [],
      };

      const result = createPreviewUrl(site as any, 'version-456', 'signature789');
      expect(result).toBeUndefined();
    });
  });

  describe('createSiteRootUrl', () => {
    test('should create proper site root URL', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [{ id: 'domain1', hostname: 'journal.com', default: true }],
      };

      const result = createSiteRootUrl(site as any);
      expect(result).toBe('https://journal.com');
    });

    test('should return undefined when no domains exist', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [],
      };

      const result = createSiteRootUrl(site as any);
      expect(result).toBeUndefined();
    });
  });

  describe('Domain priority handling', () => {
    test('should prefer default domain over first domain', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [
          { id: 'domain1', hostname: 'first.com', default: false },
          { id: 'domain2', hostname: 'second.com', default: false },
          { id: 'domain3', hostname: 'default.com', default: true },
          { id: 'domain4', hostname: 'last.com', default: false },
        ],
      };

      const result = createArticleUrl(site as any, 'work-123');
      expect(result).toBe('https://default.com/articles/work-123');
    });

    test('should handle multiple default domains by taking the first default', () => {
      const site: MockSiteDBO = {
        id: 'site1',
        name: 'test-site',
        domains: [
          { id: 'domain1', hostname: 'first.com', default: false },
          { id: 'domain2', hostname: 'first-default.com', default: true },
          { id: 'domain3', hostname: 'second-default.com', default: true },
        ],
      };

      const result = createSiteRootUrl(site as any);
      expect(result).toBe('https://first-default.com');
    });
  });
});
