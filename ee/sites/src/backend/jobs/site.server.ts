import type { DoiDeps } from '../doi/types.js';

/**
 * The site's DOI config as the job sees it. `configureCurvenote` stores `creds.role` on Curvenote
 * sites too, so `role` is null only on a CUSTOM_PREFIX site still waiting for its role. Handlers
 * refuse to post unless `status` is ACTIVE: the site may have been unlinked since enqueue.
 */
export function loadJobSite(prisma: DoiDeps['prisma'], siteId: string) {
  return prisma.siteDoiConfig.findUnique({
    where: { site_id: siteId },
    select: { role: true, status: true },
  });
}
