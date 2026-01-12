import type { Context } from './context.server.js';
import type { MyUserDBO } from './db.types.js';
import { error401, scopes } from '@curvenote/scms-core';
import { hasScopeViaSystemRole } from './roles.server.js';
import { throwRedirectOr401 } from '../utils.server.js';

export function assertUserDefined(user: any): asserts user is MyUserDBO {
  if (user === undefined) {
    throw error401('User is undefined');
  }
}

/**
 * @deprecated
 *
 * Secure the route for any user
 * @param ctx - The context object
 * @param opts - The options object
 * @returns void
 */
export async function secureAnyUser(
  ctx: Context,
  opts: {
    redirect?: boolean;
    redirectTo?: string;
  } = { redirectTo: '/app', redirect: true },
) {
  if (!ctx.user) {
    const session = await ctx.$sessionStorage.getSession(ctx.request.headers.get('Cookie'));
    throwRedirectOr401({
      ...opts,
      redirectTo: '/login',
      headers: {
        'Set-Cookie': await ctx.$sessionStorage.destroySession(session),
      },
    });
  }
}

/**
 * @deprecated
 *
 * Secure the route for a system admin
 * @param ctx - The context object
 * @param opts - The options object
 * @returns void
 */
export async function secureSystemAdmin(
  ctx: Context,
  opts: {
    redirect?: boolean;
    redirectTo?: string;
  } = { redirectTo: '/app', redirect: true },
) {
  await secureAnyUser(ctx, opts);
  assertUserDefined(ctx.user);
  if (!hasScopeViaSystemRole(ctx.user?.system_role, scopes.system.admin)) throwRedirectOr401(opts);
}
