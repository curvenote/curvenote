import type { SiteContext } from '../../../context.site.server.js';
import { userHasScope } from '../../../scopes.helpers.server.js';
import { error401, scopes } from '@curvenote/scms-core';

/**
 * @deprecated This access check is implicit in the new site context functions
 *
 * This access function should assess whether the requester is authorized to submit to the site.
 *
 * There are two possible scenarios where this should succeed:
 *  - The UI based submission system will provide a handshake token and can always submit
 *  - A user is submitting from the CLI with a valid curvenote token, and for a private site
 *    has site.submissions.create scope
 *
 * @param ctx
 * @returns
 */
export default async function (ctx: SiteContext) {
  // submission system will provide a handshake token and
  // can always submit
  // TODO: check that the site has submissions enabled
  // TODO: check that this handshake token is associated with this site
  console.log('Checking site SUBMIT access');
  if (ctx.authorized.handshake) {
    console.log(
      'ctx.site.metadata',
      (ctx.site.metadata as any | null)?.['theme_config']?.['submissions'],
    );
    return true;
  }

  // we need a valid token to submit
  if (!ctx.authorized.curvenote) {
    console.error('access.submit - no curvenote token');
    throw error401();
  }

  // public sites where submissions are not restricted, accept all submissions from the CLI, from any
  // authenticated users - additional access control is done at the endpoint level
  // TODO: public sites may have submissions disabled
  if (!ctx.site.private && !ctx.site.restricted) {
    console.log('Checking site SUBMIT access - public site, open submissions');
    return true;
  }

  if (userHasScope(ctx.user, scopes.site.submissions.create, ctx.site.name)) {
    console.log('Checking site SUBMIT access - user has scope');
    return true;
  }

  throw error401();
}
