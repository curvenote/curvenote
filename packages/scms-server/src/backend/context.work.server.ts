import { error401, error403, error404, httpError } from '@curvenote/scms-core';
import { throwRedirectOr403, throwRedirectOr404 } from '../utils.server.js';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Context, withContext } from './context.server.js';
import type { WorkAndVersionsDBO } from './loaders/works/get.server.js';
import {
  dbGetUserWorkRoles,
  dbGetWork,
  formatWorkDTO,
  getCanonicalOrLatestVersion,
} from './loaders/works/get.server.js';
import { getUserScopesSet, userHasWorkScope } from './scopes.helpers.server.js';
import { $Enums } from '@curvenote/scms-db';
import type { MyUserDBO } from './db.types.js';
import type { AllTrackEvent } from '@curvenote/scms-core';

export class WorkContext extends Context {
  work: WorkAndVersionsDBO;
  $user: NonNullable<Context['$user']>;

  get user() {
    return this.$user;
  }

  set user(user: MyUserDBO & { email_verified: boolean }) {
    // TODO: when we complete signup flow we will need to hook in email verification
    // fully, for now we just assume our early users are verified
    this.$user = { ...user, email_verified: true };
    this.scopes = Array.from(getUserScopesSet(user));
  }

  constructor(ctx: Context, work: WorkAndVersionsDBO) {
    if (!ctx.user) throw error401();
    super(ctx.$config, ctx.$auth, ctx.$sessionStorage, ctx.request);
    this.$user = ctx.user;
    this.initializeFrom(ctx);
    this.work = work;
  }

  get workDTO() {
    const version = this.work.versions
      ? getCanonicalOrLatestVersion(this.work.versions)
      : undefined;
    return formatWorkDTO(this, this.work, version);
  }

  /**
   * Track an analytics event with work context.
   * @param event - The event name to track
   * @param properties - Additional properties to include with the event
   */
  async trackEvent(event: AllTrackEvent, properties: Record<string, any> = {}): Promise<void> {
    const workProperties = {
      workId: this.work.id,
      workKey: this.work.key,
      workVersionId: this.workDTO.version_id,
      workVersionCdn: this.workDTO.cdn,
      workVersionCdnKey: this.workDTO.cdn_key,
      title: this.workDTO.title,
      description: this.workDTO.description,
      date: this.workDTO.date,
      doi: this.workDTO.doi,
      contains: this.work.contains,
      ...properties,
    };
    await super.trackEvent(event, workProperties);
  }
}

/**
 * @deprecated Usage of this function should be replaced by new app/api specific work contexts
 *
 * This context calls withContext to verify Authorization headers and tokens.
 *
 * Then, it checks that the work exists and the user has access to the work under
 * the specified scopes. The work is then added to the context for subsequent access.
 */
export async function withSecureWorkContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
): Promise<WorkContext> {
  const ctx = await withContext<T>(args);

  if (!ctx.user) throw error401();

  // Check if user is disabled - treat as authentication failure
  if (ctx.user.disabled) throw error401();

  const { workId } = args.params;
  if (!workId) throw httpError(400, 'Missing work ID');
  const work = await dbGetWork(workId);
  // Work does not exist
  if (!work) throw error404();
  const workRoles = await dbGetUserWorkRoles(ctx.user.id, workId);
  const user = { ...ctx.user, work_roles: workRoles };
  // User has no permission on the work
  if (user.work_roles.length === 0) {
    console.warn(
      'withSecureWorkContext',
      args.request.url,
      'user does not have any work_roles',
      scopes,
    );
    throw error403();
  }
  // User does not have a correct scope on the work
  if (!scopes.find((scope) => userHasWorkScope(user, scope, workId))) {
    console.warn(
      'withSecureWorkContext',
      args.request.url,
      'user does not have a correct scope on the work',
      scopes,
    );
    throw error403();
  }

  return new WorkContext(ctx, work);
}

/**
 * @deprecated Usage of this function should be replaced by new api specific work context
 */
export async function withCurvenoteWorkContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
): Promise<WorkContext> {
  const ctx = await withSecureWorkContext(args, scopes);
  if (!ctx.authorized.curvenote) throw error401();
  return ctx;
}

/**
 * Context wrapper for /app/works endpoints in the Remix app
 *
 * Validates the user is defined and has correctly scoped access to the work
 */
export async function withAppWorkContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
  opts: { redirectTo?: string; redirect?: boolean } = { redirectTo: '/app' },
): Promise<WorkContext> {
  const ctx = await withContext(args);

  const { workId } = args.params;
  if (!workId) throw httpError(400, 'Missing work ID');
  if (!ctx.user) throw error401();

  // Check if user is disabled - treat as authentication failure
  if (ctx.user.disabled) throw error401();
  // User has no permission on the work
  if (ctx.user.system_role !== $Enums.SystemRole.ADMIN && ctx.user.work_roles.length === 0) {
    throw throwRedirectOr404(opts);
  }
  // User does not have a correct scope on the work
  if (!scopes.find((scope) => userHasWorkScope(ctx.user, scope, workId))) {
    console.warn(
      'withAppWorkContext',
      args.request.url,
      'user does not have a correct scope on the work',
      scopes,
    );
    throw throwRedirectOr403(opts);
  }
  const work = await dbGetWork(workId);
  // Work does not exist
  if (!work) throw throwRedirectOr404(opts);
  return new WorkContext(ctx, work);
}

/**
 * Context wrapper for /v1/works endpoints in the api
 *
 * Validates the user is defined and has correctly scoped access to the work
 */
export async function withAPIWorkContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
): Promise<WorkContext> {
  const ctx = await withAppWorkContext(args, scopes, { redirect: false });
  if (!ctx.authorized.curvenote) throw error401();
  return ctx;
}
