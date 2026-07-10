import type { ServerExtension } from './types.js';

/**
 * Resolves the extension that owns submit-to-site for a site.
 * Requires both `getOperatedSites` (site match) and a declared `submitToSite` handler.
 * Extensions that operate a site but omit `submitToSite` use the central route instead.
 */
export function resolveSubmitToSiteExtension(
  extensions: ServerExtension[],
  siteName: string,
): ServerExtension | undefined {
  return extensions.find(
    (extension) => !!extension.submitToSite && !!extension.getOperatedSites?.().includes(siteName),
  );
}
