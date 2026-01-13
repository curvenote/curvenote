import { httpError } from '@curvenote/scms-core';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { withContext } from './context.server.js';
import { dbGetSite } from './loaders/sites/get.server.js';
import * as access from './loaders/sites/access/index.js';
import { SiteContext } from './context.site.server.js';

/**
 * @deprecated Usage of this function should be replaced by new app/api specific site contexts
 *
 * withSecureSiteContext should *probably* be used on all public API endpoints beginning with /v1/sites/{name}
 *
 * It calls the underlying withContext, to follow the same auth flow as the rest of the api.
 *
 * Any tokens provided in the Authorization header will have been tested as handshake or curvenote
 * tokens and may have been verified as valid.
 *
 * This function will verify the site token, and if it is invalid it will check for a curvenote token
 * and verify access via scopes.
 *
 * @param args
 * @param fn
 * @param opts
 * @returns
 */
export async function withSecureSiteContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
): Promise<SiteContext> {
  const ctx = await withContext(args);

  const { siteName } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  const site = await dbGetSite(siteName);
  if (!site || !site.metadata) throw httpError(404, 'Site not found');
  const siteCtx = new SiteContext(ctx, site);

  if (['HEAD', 'GET', 'OPTIONS'].includes(args.request.method)) {
    await access.read(siteCtx);
  } else {
    await access.submit(siteCtx);
  }

  return siteCtx;
}
