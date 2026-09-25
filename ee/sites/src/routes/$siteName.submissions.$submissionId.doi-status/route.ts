import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { scopes, site as siteScopes } from '@curvenote/scms-core';
import { userHasScope, withAppSiteContext } from '@curvenote/scms-server';
import { loadDoiRegistrationView } from '../$siteName.submissions.$submissionId/doiRegistration.server.js';
import { doiRowRefreshKey } from '../$siteName.submissions.$submissionId/doiRowRefresh.js';
import type { DoiStatusResponse } from '../$siteName.submissions.$submissionId/doiRowRefresh.js';

/**
 * JSON-only resource route polled by the DOI row while a registration is in progress:
 *   GET /app/sites/:siteName/submissions/:submissionId/doi-status -> { key }
 * `redirect: false` so a scope or site-access refusal answers 403/404, not a 302 to /app that
 * `fetch` would follow and try to parse as JSON.
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.doi.read], { redirect: false });
  if (!userHasScope(ctx.user, scopes.app.sites.doi.feature)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }
  const submissionId = args.params.submissionId;
  if (!submissionId) {
    return data({ error: 'Missing submission id' }, { status: 400 });
  }
  const view = await loadDoiRegistrationView(ctx.site.id, submissionId);
  return data<DoiStatusResponse>({ key: doiRowRefreshKey(view) });
}
