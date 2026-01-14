import { error401, error403, error404, httpError } from '@curvenote/scms-core';
import { throwRedirectOr403, throwRedirectOr404 } from '../utils.server.js';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { getSitePublicKey } from './sign.private.server.js';
import jwt from 'jsonwebtoken';
import { withAppContext, withContext, Context } from './context.server.js';
import { dbGetSite, formatSiteDTO, type DBO as SiteDBO } from './loaders/sites/get.server.js';
import { SiteRole, SystemRole } from '@prisma/client';
import type { AllTrackEvent } from '@curvenote/scms-core';
import { hasSiteScope } from './roles.server.js';
import { getUserScopesSet, userHasSiteScope } from './scopes.helpers.server.js';
import { formatDate } from '@curvenote/common';
import type { MyUserDBO } from './db.types.js';

export class SiteContext extends Context {
  site: SiteDBO;

  constructor(ctx: Context, site: SiteDBO) {
    super(ctx.$config, ctx.$auth, ctx.$sessionStorage, ctx.request);
    this.initializeFrom(ctx);
    this.site = site;
  }

  get private() {
    return this.site.private;
  }

  get authorized() {
    return {
      ...super.authorized,
      site: !!this.$verifiedSiteToken,
    };
  }

  get token() {
    return {
      ...super.token,
      site: this.$verifiedSiteToken,
    };
  }

  get claims() {
    return {
      ...super.claims,
      site: this.$siteClaims,
    };
  }

  get siteDTO() {
    return formatSiteDTO(this, this.site);
  }

  $verifiedSiteToken?: string;
  $siteClaims?: jwt.JwtPayload;

  async verifySiteToken(token: string): Promise<void> {
    const key = await getSitePublicKey(this.site, this.$config.api.propertyPublicKey);
    if (!key) throw error401('Could not get site public key');

    try {
      const claims = jwt.verify(token, key, {
        subject: this.$config.api.privateSiteClaimSubject,
      });
      if (!claims || typeof claims !== 'object' || !claims.aud || typeof claims.aud !== 'string') {
        console.error('Invalid token, missing required claims', claims);
        throw error401('Invalid token, missing required claims');
      }

      if (!claims.name || claims.name !== this.site.name) {
        console.error('Invalid site name, got:', claims.name, 'expected:', this.site.name);
        throw error401(`Invalid site name, got: ${claims.name} expected: ${this.site.name}`);
      }

      this.$verifiedSiteToken = token;
      this.$siteClaims = claims;
    } catch (err: any) {
      this.$verifiedSiteToken = undefined;
      this.$siteClaims = undefined;
      console.error('Error validating site token', err);
      throw error401('Invalid token (verify)');
    }
  }

  /**
   * Track an analytics event with site context.
   * @param event - The event name to track
   * @param properties - Additional properties to include with the event
   */
  async trackEvent(event: AllTrackEvent, properties: Record<string, any> = {}): Promise<void> {
    const siteProperties = {
      siteId: this.site.id,
      siteName: this.site.name,
      sitePrivate: this.site.private,
      siteRestricted: this.site.restricted,
      ...properties,
    };
    await super.trackEvent(event, siteProperties);
  }
}

/**
 * SiteContextWithUser
 *
 * Is a class that extends SiteContext exactly but where the user property is is always defined.
 * It can only be constructed from an existing SiteContext object where the user field is defined.
 */
export class SiteContextWithUser extends SiteContext {
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

  constructor(ctx: Context, site: SiteDBO) {
    if (!ctx.user) throw error401();
    super(ctx, site);
    this.$user = ctx.user;
  }
}

/**
 * Basic context wrapper that loads the site
 *
 * This is "insecure" because it does nothing to check user access to the site.
 */
export async function withInsecureSiteContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
) {
  const ctx = await withContext(args);

  const { siteName } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  const site = await dbGetSite(siteName);
  if (!site || !site.metadata) throw httpError(404, 'Site not found');
  const siteCtx = new SiteContext(ctx, site);

  return siteCtx;
}

/**
 * Temporarily grant a user object public/unrestricted roles, if allowed by the site
 */
export function addPublicSiteRoles(user: MyUserDBO, site: SiteDBO) {
  const timestamp = formatDate();
  if (!site.private) {
    user.site_roles.push({
      id: 'public',
      date_created: timestamp,
      date_modified: timestamp,
      user_id: user.id,
      site_id: site.id,
      role: SiteRole.PUBLIC,
      site,
    });
  }
  if (!site.restricted) {
    user.site_roles.push({
      id: 'unrestricted',
      date_created: timestamp,
      date_modified: timestamp,
      user_id: user.id,
      site_id: site.id,
      role: SiteRole.UNRESTRICTED,
      site,
    });
  }
}

/**
 * Context wrapper for /app/sites endpoints in the Remix app
 *
 * Validates the user is defined and has correctly scoped access to the site.
 * If multiple scopes are provided, the user must have at least one of the scopes.
 */
export async function withAppSiteContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
  opts: { redirectTo?: string; redirect?: boolean } = { redirectTo: '/app' },
): Promise<SiteContextWithUser> {
  const ctx = await withAppContext<T>(args);

  const { siteName } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  if (!ctx.user) throw error401();

  const site = await dbGetSite(siteName);
  if (!site || !site.metadata) throw throwRedirectOr404(opts);
  const siteCtx = new SiteContextWithUser(ctx, site);
  addPublicSiteRoles(ctx.user, site);

  // User has no permission on the site
  if (ctx.user.system_role !== SystemRole.ADMIN && ctx.user.site_roles.length === 0) {
    throw throwRedirectOr404(opts);
  }
  // User does not have a correct scope on the site
  if (
    ctx.user.system_role !== SystemRole.ADMIN &&
    !scopes.find((scope) => userHasSiteScope(ctx.user, scope, site.id))
  ) {
    console.warn(
      'withAppSiteContext',
      args.request.url,
      'user does not have a correct scope on the site',
      scopes,
    );
    throw throwRedirectOr403(opts);
  }

  return siteCtx;
}

/**
 * Context wrapper for /v1/sites endpoints in the API
 *
 * Under this context, requests with handshake tokens are allowed to perform any action,
 * requests with site tokens are allowed to perform the same actions granted by public role,
 * and otherwise, users are authorized with their Curvenote token and granted access
 * based on available site scopes.
 */
export async function withAPISiteContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
): Promise<SiteContext> {
  const ctx = await withContext(args);

  const { siteName } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  const site = await dbGetSite(siteName);
  if (!site || !site.metadata) throw error404('Site not found');
  const siteCtx = new SiteContext(ctx, site);
  // A valid handshake token enables all site API actions
  if (ctx.authorized.handshake) return siteCtx;

  // A valid site token enables any site API actions that are available on public sites
  const authString = ctx.request.headers.get('Authorization');
  if (authString) {
    const token = authString.split('Bearer ')[1];
    try {
      await siteCtx.verifySiteToken(token);
      if (scopes.find((scope) => hasSiteScope(SiteRole.PUBLIC, scope))) return siteCtx;
    } catch (e: any) {
      console.error('Error verifying site token', e);
    }
  }
  if (!ctx.user) throw error401();
  if (!ctx.authorized.curvenote) throw error401();

  // Check if user is disabled - treat as authentication failure
  if (ctx.user.disabled) throw error401();

  addPublicSiteRoles(ctx.user, site);
  // User has no permission on the site
  if (ctx.user.system_role !== SystemRole.ADMIN && ctx.user.site_roles.length === 0) {
    throw error404();
  }
  // User does not have a correct scope on the site
  if (!scopes.find((scope) => userHasSiteScope(ctx.user, scope, site.id))) {
    console.warn(
      'withAPISiteContext',
      args.request.url,
      'user does not have a correct scope on the site',
      scopes,
    );
    throw error403();
  }
  return siteCtx;
}
