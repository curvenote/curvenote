import type { Route } from './+types/v1.sites.$siteName.sign';
import { error404, error405 } from '@curvenote/scms-core';
import {
  CreateSignedUrlPostBodySchema,
  validate,
  withSecureSiteContext,
  getSignedCDNQuery,
  ensureJsonBodyFromMethod,
} from '@curvenote/scms-server';

export async function loader() {
  throw error405();
}

/**
 *  A secured private site can request a signed URL for a CDN query scoped to the baseUrl provided
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withSecureSiteContext(args);
  if (args.request.method !== 'POST') return error405();
  if (!ctx.site.private) throw error404();

  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const { baseUrl } = validate(CreateSignedUrlPostBodySchema, body);

  return getSignedCDNQuery(ctx, baseUrl); // returns plain text, as before
}
