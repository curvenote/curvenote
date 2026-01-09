import type { SiteContext } from '../../../context.site.server.js';
import { userHasScope } from '../../../scopes.helpers.server.js';
import { httpError, scopes } from '@curvenote/scms-core';

/**
 * @deprecated This access check is implicit in the new site context functions
 */
export default async function (ctx: SiteContext) {
  // public sites always allow read access
  if (!ctx.site.private) {
    return true;
  } // otherwise site.private

  // access can be via site read scope
  if (userHasScope(ctx.user, scopes.site.submissions.read, ctx.site.name)) {
    return true;
  }

  // TODO: do we need to check for a session token, for then this is accessed from the admin app?
  // TODO also we don't want a redirect to login on unrelated cookie expiry, if there's a cookie

  // otherwise we need a valid site token
  const authString = ctx.request.headers.get('Authorization');
  if (!authString) throw httpError(401, 'No site token provided');
  const token = authString.split('Bearer ')[1];
  try {
    await ctx.verifySiteToken(token);
  } catch (e: any) {
    console.error('Error verifying site token', e);
    throw e;
  }
  return true;
}
