import type { SiteLayoutSite } from '../$siteName/layout.format.server.js';
import { formatSiteLayoutSite } from '../$siteName/layout.format.server.js';
import type { SiteContext } from '@curvenote/scms-server';

/** Site fields passed into SubmissionList / actions on this route. */
export type SubmissionListingSiteContext = SiteLayoutSite;

export function formatSubmissionListingSiteContext(ctx: SiteContext): SubmissionListingSiteContext {
  return formatSiteLayoutSite(ctx);
}
