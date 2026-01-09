import type { Route } from './+types/v1.sites.$siteName.access';
import { error401, httpError, scopes } from '@curvenote/scms-core';
import {
  withAPISecureContext,
  addPublicSiteRoles,
  sites,
  userHasSiteScope,
} from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const { siteName } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  if (!ctx.user) throw error401();
  const site = await sites.dbGetSite(siteName);
  if (!site || !site.metadata) throw httpError(404, 'Site not found');
  // QUESTION: in response to a GET call we are adding public roles to the user object? is this a half way towards a bigger change?
  addPublicSiteRoles(ctx.user, site);
  const read = userHasSiteScope(ctx.user, scopes.site.read, site.id);
  const submit = userHasSiteScope(ctx.user, scopes.site.submissions.create, site.id);
  return Response.json({
    read,
    submit,
  });
}
