import type { DBO as SiteDBO } from './loaders/sites/get.server.js';

/**
 * Helper function to get primary domain from site domains
 * Prefers domain marked as default, falls back to first domain
 */
export function getPrimaryDomain(site: SiteDBO) {
  return site.domains.find((d) => d.default) ?? site.domains[0];
}

/**
 * Helper function to create a domain-based URL for site content
 * Returns undefined if no domain is available
 */
export function createSiteUrl(site: SiteDBO, path: string): string | undefined {
  const domain = getPrimaryDomain(site);
  return domain ? `https://${domain.hostname}${path}` : undefined;
}

/**
 * Helper function to create a domain-based URL for an article
 * Returns undefined if no domain is available
 */
export function createArticleUrl(site: SiteDBO, workId: string): string | undefined {
  return createSiteUrl(site, `/articles/${workId}`);
}

/**
 * Helper function to create a domain-based URL for a preview
 * Returns undefined if no domain is available
 */
export function createPreviewUrl(
  site: SiteDBO,
  submissionVersionId: string,
  signature: string,
): string | undefined {
  return createSiteUrl(site, `/previews/${submissionVersionId}?preview=${signature}`);
}

/**
 * Helper function to create a domain-based URL for site root
 * Returns undefined if no domain is available
 */
export function createSiteRootUrl(site: SiteDBO): string | undefined {
  return createSiteUrl(site, '');
}
