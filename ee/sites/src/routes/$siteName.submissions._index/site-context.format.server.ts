import type { SiteContext } from '@curvenote/scms-server';
import type { SiteLayoutSite } from '../$siteName/layout.format.server.js';
import { formatSiteLayoutSite } from '../$siteName/layout.format.server.js';

/** Site fields passed into submission listing UI and actions. */
export type SubmissionListingSiteContext = SiteLayoutSite;

export function formatSubmissionListingSiteContext(ctx: SiteContext): SubmissionListingSiteContext {
  return formatSiteLayoutSite(ctx);
}
