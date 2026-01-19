import { error401, error403, error404, httpError } from '@curvenote/scms-core';
import { throwRedirectOr404 } from '../utils.server.js';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { Context } from './context.server.js';
import { withContext } from './context.server.js';
import type { WorkAndVersionsDBO } from './loaders/works/get.server.js';
import {
  dbGetUserWorkRoles,
  dbGetWork,
  formatWorkDTO,
  getCanonicalOrLatestVersion,
} from './loaders/works/get.server.js';
import { userHasSiteScope, userHasWorkScope } from './scopes.helpers.server.js';
import { SiteContextWithUser } from './context.site.server.js';
import { dbGetSite, dbGetUserSiteRoles, type DBO as SiteDBO } from './loaders/sites/get.server.js';
import { dbGetSubmission, formatSubmissionDTO } from './loaders/sites/submissions/get.server.js';
import type { Prisma } from '@curvenote/scms-db';
import { formatSubmissionVersionDTO } from './loaders/sites/submissions/versions/get.server.js';
import type { AllTrackEvent, ClientExtension } from '@curvenote/scms-core';

type SubmissionAndVersionsDBO = Exclude<Awaited<ReturnType<typeof dbGetSubmission>>, null>;

export class SubmissionContext extends SiteContextWithUser {
  work: WorkAndVersionsDBO;
  submission: SubmissionAndVersionsDBO;

  constructor(
    ctx: Context,
    site: SiteDBO,
    work: WorkAndVersionsDBO,
    submission: SubmissionAndVersionsDBO,
  ) {
    super(ctx, site);
    this.work = work;
    this.submission = submission;
  }

  get workDTO() {
    const version = this.work.versions
      ? getCanonicalOrLatestVersion(this.work.versions)
      : undefined;
    return formatWorkDTO(this, this.work, version);
  }

  async submissionDTO(extensions: ClientExtension[]) {
    return formatSubmissionDTO(this, this.submission, extensions);
  }

  get submissionVersionDTO() {
    if (this.submission.versions.length === 0) return undefined;
    return formatSubmissionVersionDTO(this, {
      ...this.submission.versions[0],
      submission: this.submission,
    });
  }

  /**
   * Track an analytics event with submission context.
   * @param event - The event name to track
   * @param properties - Additional properties to include with the event
   */
  async trackEvent(event: AllTrackEvent, properties: Record<string, any> = {}): Promise<void> {
    const submissionProperties = {
      submissionId: this.submission.id,
      submissionKindId: this.submission.kind.id,
      submissionKindName: this.submission.kind.name,
      submissionCollectionId: this.submission.collection.id,
      submissionCollectionName: this.submission.collection.name,
      submissionVersionId: this.submissionVersionDTO?.id,
      submissionVersionStatus: this.submissionVersionDTO?.status,
      workId: this.work.id,
      workKey: this.work.key,
      workVersionId: this.workDTO.version_id,
      workVersionCdn: this.workDTO.cdn,
      workVersionCdnKey: this.workDTO.cdn_key,
      title: this.workDTO.title,
      description: this.workDTO.description,
      date: this.workDTO.date,
      doi: this.workDTO.doi,
      ...properties,
    };
    await super.trackEvent(event, submissionProperties);
  }
}

/**
 * @deprecated Usage of this function should be replaced by new app/api specific submission contexts
 *
 * This context calls withContext to verify Authorization headers and tokens.
 *
 * Then, it checks that the submission exists and the user has access to the submission under
 * the specified scopes on either the site or the work. The submission and work are then added
 * to the context for subsequent access.
 */
export async function withScopedSubmissionContext<
  T extends LoaderFunctionArgs | ActionFunctionArgs,
>(args: T, scopes: string[]): Promise<SubmissionContext> {
  const ctx = await withContext(args);

  if (!ctx.user) throw error401();

  const { siteName, submissionId } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  if (!submissionId) throw httpError(400, 'Missing submission ID');

  const site = await dbGetSite(siteName);
  const submission = await dbGetSubmission({ id: submissionId });
  if (!site || !site.metadata || !submission) throw error404();

  // TODO: add work to submission and validate
  const workId = submission.work_id ?? submission.versions[0]?.work_version?.work_id;
  let userAccess = false;

  // Determine if user has access to the submission from the work.
  // This is only possible for public, unrestricted sites.
  if (!site.private && !site.restricted) {
    const workRoles = await dbGetUserWorkRoles(ctx.user.id, workId);
    const user = { ...ctx.user, work_roles: workRoles };
    userAccess = !!scopes.find((scope) => userHasWorkScope(user, scope, workId));
  }

  // Determine if user has access to the submission from the site.
  if (!userAccess) {
    const siteRoles = await dbGetUserSiteRoles(ctx.user.id, site.id);
    const user = { ...ctx.user, site_roles: siteRoles };
    userAccess = !!scopes.find((scope) => userHasSiteScope(user, scope, site.id));
  }

  if (!userAccess) {
    console.warn(
      'withSecureSubmissionContext',
      args.request.url,
      'user does not have a correct scope on the submission',
      scopes,
    );
    throw error403();
  }
  const work = await dbGetWork(workId);
  // Work does not exist
  if (!work) throw error404;

  return new SubmissionContext(ctx, site, work, submission);
}

/**
 * @deprecated Usage of this function should be replaced by new api specific submission context
 */
export async function withCurvenoteSubmissionContext<
  T extends LoaderFunctionArgs | ActionFunctionArgs,
>(args: T, scopes: string[]): Promise<SubmissionContext> {
  const ctx = await withScopedSubmissionContext<T>(args, scopes);
  if (!ctx.authorized.curvenote) throw error401();
  return ctx;
}

/**
 * Context wrapper for /app/sites/{siteName}/submissions endpoints in the Remix app
 *
 * Validates the user is defined and has correctly scoped access to the submission, either
 * via the site or the work.
 */
export async function withAppSubmissionContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
  opts: { redirectTo?: string; redirect?: boolean } = { redirectTo: '/app' },
): Promise<SubmissionContext> {
  const ctx = await withContext(args);

  const { siteName, submissionId } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  if (!submissionId) throw httpError(400, 'Missing submission ID');
  if (!ctx.user) throw error401();
  const site = await dbGetSite(siteName);
  const submission = await dbGetSubmission({ id: submissionId });
  if (!site || !site.metadata || !submission) throw throwRedirectOr404(opts);
  const workId = submission.work_id ?? submission.versions[0]?.work_version?.work_id;
  let userAccess = false;
  // Determine if user has access to the submission from the work.
  // This is only possible for public, unrestricted sites.
  if (!site.private && !site.restricted) {
    userAccess = !!scopes.find((scope) => userHasWorkScope(ctx.user, scope, workId));
  }
  // Determine if user has access to the submission from the site.
  if (!userAccess) {
    userAccess = !!scopes.find((scope) => userHasSiteScope(ctx.user, scope, site.id));
  }
  if (!userAccess) throw throwRedirectOr404(opts);
  const work = await dbGetWork(workId);
  // Work does not exist
  if (!work) throw throwRedirectOr404(opts);
  const submissionCtx = new SubmissionContext(ctx, site, work, submission);

  return submissionCtx;
}

/**
 * Context wrapper for /v1/sites/{siteName}/submissions endpoints in the api
 *
 * Validates the user is defined and has correctly scoped access to the submission, either
 * via the site or the work.
 */
export async function withAPISubmissionContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
  opts?: { allowHandshake?: boolean },
): Promise<SubmissionContext> {
  const ctx = await withAppSubmissionContext(args, scopes, { redirect: false });
  const authorizedByHandshake = opts?.allowHandshake && ctx.authorized.handshake;
  if (!authorizedByHandshake && !ctx.authorized.curvenote) throw error401();
  return ctx;
}
