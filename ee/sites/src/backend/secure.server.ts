import type { SiteContext } from '@curvenote/scms-server';
import { throwRedirectOr401, secureAnyUser, userHasScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';

/**
 * Secure the route for a site user
 * @param ctx - The context object
 * @param opts - The options object
 * @returns void
 */
export async function secureSiteUser(
  ctx: SiteContext,
  opts: {
    redirect?: boolean;
    redirectTo?: string;
  } = { redirectTo: '/app', redirect: true },
) {
  await secureAnyUser(ctx, opts);

  if (!userHasScope(ctx.user, scopes.site.read, ctx.site.name)) {
    throwRedirectOr401(opts);
  }
}
