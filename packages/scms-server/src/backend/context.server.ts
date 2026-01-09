import type { MyUserDBO, UserWithRolesDBO } from './db.types.js';
import {
  error401,
  httpError,
  withApiBaseUrl,
  withBaseUrl,
  isAdmin,
  system,
  app,
} from '@curvenote/scms-core';
import type {
  Context as ContextType,
  DefaultEmailProps,
  ResendEventType,
  AllTrackEvent,
  EventOptions,
  ExtensionEmailTemplate,
} from '@curvenote/scms-core';
import { redirect } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs, SessionStorage } from 'react-router';
import { decodeTokenPayload } from './processing.server.js';
import type {
  CurvenoteTokenClaims,
  HandshakeTokenClaims,
  PreviewTokenClaims,
} from './processing.server.js';
import { hasScopeViaSystemRole } from './roles.server.js';
import { userHasScope, getUserScopesSet, userHasScopes } from './scopes.helpers.server.js';
import { verifyPreviewToken } from './sign.previews.server.js';
import { verifyHandshakeToken } from './sign.handshake.server.js';
import type { ModifyUrl } from './loaders/types.js';
import { getConfig } from '../app-config.server.js';
import { sessionStorageFactory, type Session } from '../session.server.js';
import { validateSessionJWT } from './loaders/tokens/session.server.js';
import { throwOnMinimumCurvenoteClientVersion } from './minimumClient.server.js';
import type { AppAuthenticator } from '../modules/auth/auth.server.js';
import { authenticatorFactory } from '../modules/auth/auth.server.js';
import { provisionNewUserFromEditorAPI } from '../modules/auth/common.server.js';
import { throwRedirectOr401, throwRedirectOr403 } from '../utils.server.js';
import type { SlackMessage } from './services/slack.server.js';
import { $sendSlackNotification } from './services/slack.server.js';
import type { Resend } from 'resend';
import type { TemplatedResendEmail } from './services/emails/resend.server.js';
import { $sendEmail, $sendEmailBatch, getResend } from './services/emails/resend.server.js';
import { createUnsubscribeToken } from './sign.tokens.server.js';
import { dbGetUnsubscribedEmail } from './loaders/unsubscribe.js';
import { addSegmentAnalytics, AnalyticsContext } from './services/analytics/segment.server.js';
import type { User } from '@prisma/client';
import { getPrismaClient } from './prisma.server.js';

/**
 * Look up user by curvenote userId
 *
 * @param id
 * @returns
 */
export async function getUserById(id: string): Promise<UserWithRolesDBO | null> {
  const prisma = await getPrismaClient();
  return prisma.user.findUnique({
    where: { id },
    include: {
      site_roles: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      },
      work_roles: true,
      linkedAccounts: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

export class Context implements ContextType {
  asApiUrl: ModifyUrl;
  asBaseUrl: ModifyUrl;
  request: Request;
  scopes: string[];

  get user() {
    return this.$user;
  }

  set user(user: (MyUserDBO & { email_verified: boolean }) | undefined) {
    // TODO: when we complete signup flow we will need to hook in email verification
    // fully, for now we just assume our early users are verified
    this.$user = user ? { ...user, email_verified: true } : undefined;
    this.scopes = user ? Array.from(getUserScopesSet(user)) : [];
  }

  get authorized() {
    return {
      user: !!this.user,
      preview: !!this.$verifiedPreviewToken,
      curvenote: !!this.$verifiedCurvenoteToken,
      handshake: !!this.$verifiedHandshakeToken,
    };
  }

  get token() {
    return {
      preview: this.$verifiedPreviewToken,
      curvenote: this.$verifiedCurvenoteToken,
      handshake: this.$verifiedHandshakeToken,
      session: this.$verifiedSession,
    };
  }

  get claims() {
    return {
      preview: this.$previewClaims,
      handshake: this.$handshakeClaims,
      curvenote: this.$curvenoteClaims,
    };
  }

  get resend() {
    if (!this.$resend) {
      this.$resend = getResend(this.$config.api?.resend);
    }
    return this.$resend;
  }

  get analytics() {
    if (!this.$analytics?.segment) {
      addSegmentAnalytics(this.$analytics, this.$config.api?.segment);
    }
    return this.$analytics;
  }

  // $config: Awaited<ReturnType<typeof getConfig>>;
  $user?: MyUserDBO & { email_verified: boolean };
  $verifiedPreviewToken?: string;
  $previewClaims?: PreviewTokenClaims;
  $verifiedCurvenoteToken?: string;
  $curvenoteClaims?: CurvenoteTokenClaims;
  $verifiedHandshakeToken?: string;
  $handshakeClaims?: HandshakeTokenClaims;
  $verifiedSession: boolean;
  $resend?: Resend;
  $analytics: AnalyticsContext;

  constructor(
    public $config: Awaited<ReturnType<typeof getConfig>>,
    public $auth: AppAuthenticator,
    public $sessionStorage: SessionStorage,
    request: Request,
    analytics?: AnalyticsContext,
  ) {
    this.request = request;
    this.asApiUrl = withApiBaseUrl(request);
    this.asBaseUrl = withBaseUrl(request);
    this.scopes = [];
    this.$verifiedSession = false;
    // Use provided analytics instance (from middleware) or create new one
    this.$analytics = analytics ?? new AnalyticsContext();
  }

  initializeFrom(ctx: Context) {
    this.user = ctx.user;
    this.$config = ctx.$config;
    this.$auth = ctx.$auth;
    this.$sessionStorage = ctx.$sessionStorage;
    this.$verifiedPreviewToken = ctx.$verifiedPreviewToken;
    this.$previewClaims = ctx.$previewClaims;
    this.$verifiedCurvenoteToken = ctx.$verifiedCurvenoteToken;
    this.$curvenoteClaims = ctx.$curvenoteClaims;
    this.$verifiedHandshakeToken = ctx.$verifiedHandshakeToken;
    this.$handshakeClaims = ctx.$handshakeClaims;
    this.$verifiedSession = ctx.$verifiedSession;
  }

  privateCdnUrls() {
    return new Set(
      Object.keys(this.$config.api.privateCDNSigningInfo).map((hostname) => `https://${hostname}/`),
    );
  }

  verifyPreviewToken(token: string) {
    try {
      const claims = verifyPreviewToken(
        token,
        this.$config.api.previewIssuer,
        this.$config.api.previewSigningSecret,
      );
      this.$verifiedPreviewToken = token;
      const { scope, scopeId } = claims;
      this.$previewClaims = { scope, scopeId };
    } catch (err: any) {
      console.error('Invalid preview token', err);
      this.$verifiedPreviewToken = undefined;
      this.$previewClaims = undefined;
    }
  }

  async verifyCurvenoteSessionToken(token: string) {
    const payload = token ? decodeTokenPayload(token) : undefined;
    if (!payload) {
      console.error('Could not decode token payload');
    }

    // we accept tokens from multiple audiences, we could lock this
    // down to a whitelist of audiences via configuration if needed
    let claims;
    if (payload && payload.iss?.endsWith('/tokens/session')) {
      try {
        claims = validateSessionJWT(this, token);
        // this throws if the token is invalid, immediate 401
        this.$verifiedCurvenoteToken = token;
        const { user_id, name, email } = claims;

        try {
          let user = await getUserById(user_id);
          if (!user) {
            // token is valid but user is not in the sites database yet, only in the editor
            // In test environment, don't try to provision from editor API
            if (process.env.NODE_ENV === 'test' || process.env.APP_CONFIG_ENV === 'test') {
              console.log('Test environment: skipping editor API call for user provisioning');
              throw httpError(
                401,
                `User not found in test environment.${name && email ? `(${name}, ${email})` : ''}`,
              );
            }

            // provide a new user
            user = await provisionNewUserFromEditorAPI(this.$config, {
              uid: user_id,
              displayName: name!,
              email: email!,
            });

            console.log('Provisioned new user from firebase via token verification', user);
          }

          if (!user) {
            throw httpError(401, `User not found.${name && email ? `(${name}, ${email})` : ''}`);
          }
          this.$curvenoteClaims = { aud: payload.aud as string };
          this.user = { email_verified: false, ...user };
        } catch (err) {
          console.error('User not found', err);
          throw err;
        }
      } catch (err) {
        this.$verifiedCurvenoteToken = undefined;
        this.$curvenoteClaims = undefined;
        this.user = undefined;
        throw err;
      }
    } else {
      console.log('Not a Curvenote token or non-conforming issuer', {
        issuer: payload?.iss,
        issuerConforms: payload?.iss?.endsWith('/tokens/session') ?? false,
        signatureVerified: !!claims,
      });
    }
  }

  async verifyHandshakeToken(token: string) {
    const payload = token ? decodeTokenPayload(token) : undefined;
    if (payload && payload.iss === this.$config.api.handshakeIssuer) {
      try {
        verifyHandshakeToken(
          token.replace(/^Bearer\s?/, ''),
          this.$config.api.handshakeIssuer,
          this.$config.api.handshakeSigningSecret,
        ); // remove 'Bearer '
        // this throws if the token is invalid, immediate 401
        this.$verifiedHandshakeToken = token;
        this.$handshakeClaims = { jobId: payload.jobId };
        const saUser = await getUserById(this.$config.api.submissionsServiceAccount.id);
        if (!saUser) throw httpError(500, 'Could not recover service account user');
        this.user = { email_verified: false, ...saUser };
      } catch (err) {
        this.$verifiedHandshakeToken = undefined;
        this.$handshakeClaims = undefined;
        this.user = undefined;
        throw err;
      }
    }
  }

  async verifySession(session: Session) {
    const user = session.get('user');
    const userId = user?.userId;
    if (userId) {
      try {
        // TODO verify provider tokens to look for provider triggered revoke
        // await verifyProviderAccessViaRefreshToken(...);

        const dbUser = await getUserById(userId);
        if (!dbUser) throw httpError(401, 'Unknown user session');
        // TODO: get email_verified into the model
        this.user = { email_verified: false, ...dbUser };
        this.$verifiedSession = true;
      } catch (error: any) {
        console.log('Error validating token', error.statusText);
        this.$verifiedSession = false;
        this.user = undefined;

        throw redirect('/login', {
          headers: {
            'Set-Cookie': await this.$sessionStorage.destroySession(session),
          },
        });
      }
    }
  }

  async sendSlackNotification(message: SlackMessage) {
    await $sendSlackNotification(message, this.$config.api?.slack);
  }

  async sendEmail<T extends ResendEventType, P extends object>(
    email: TemplatedResendEmail<T, P>,
    extensionTemplates?: ExtensionEmailTemplate[],
  ) {
    if (!email.ignoreUnsubscribe && !!(await dbGetUnsubscribedEmail(email.to))) {
      console.log(`Not sending to unsubscribed email: ${email.to}`);
      return;
    }
    const defaultProps: DefaultEmailProps = {
      asBaseUrl: (path) => this.asBaseUrl(path),
      branding: this.$config.app?.branding,
    };
    const jwtKey = this.$config.api?.resend?.apiKey;
    if (jwtKey && !email.ignoreUnsubscribe) {
      defaultProps.unsubscribeUrl = this.asBaseUrl(
        `/unsubscribe?token=${createUnsubscribeToken(email.to, jwtKey)}`,
      );
    }
    await $sendEmail(
      email,
      defaultProps,
      {
        resend: this.resend,
        resendConfig: this.$config.api?.resend,
      },
      extensionTemplates,
    );
  }

  async sendEmailBatch<T extends ResendEventType, P extends object>(
    emails: TemplatedResendEmail<T, P>[],
    extensionTemplates?: ExtensionEmailTemplate[],
  ) {
    const emailBatch = (
      await Promise.all(
        emails.map(async (email) => {
          if (!email.ignoreUnsubscribe && !!(await dbGetUnsubscribedEmail(email.to))) {
            console.log(`Not sending to unsubscribed email: ${email.to}`);
            return;
          }
          const defaultProps: DefaultEmailProps = {
            asBaseUrl: (path) => this.asBaseUrl(path),
            branding: this.$config.app?.branding,
          };
          const jwtKey = this.$config.api?.resend?.apiKey;
          if (jwtKey && !email.ignoreUnsubscribe) {
            defaultProps.unsubscribeUrl = this.asBaseUrl(
              `/unsubscribe?token=${createUnsubscribeToken(email.to, jwtKey)}`,
            );
          }
          return { email, defaultProps };
        }),
      )
    ).filter((item) => item !== undefined);
    await $sendEmailBatch(
      emailBatch,
      {
        resend: this.resend,
        resendConfig: this.$config.api?.resend,
      },
      extensionTemplates,
    );
  }

  /**
   * Identify a user for analytics tracking.
   * Uses the current user from context - no parameters required.
   *
   * @param user - Optional user to identify. If not provided, the current user from context will be used.
   */
  async identifyEvent(user?: User): Promise<void> {
    const userToIdentify = user ?? this.user;
    if (!userToIdentify) {
      console.log('identifyEvent called but no user in context');
      return;
    }
    await this.analytics.identifyEvent(userToIdentify);
  }

  /**
   * Track an analytics event.
   * @param event - The event name to track
   * @param properties - Additional properties to include with the event
   * @param opts - Options including whether the event is anonymous
   */
  async trackEvent(
    event: AllTrackEvent,
    properties: Record<string, any> = {},
    opts: EventOptions = {},
  ): Promise<void> {
    if (opts.ignoreAdmin && isAdmin(this.$user)) {
      console.log('trackEvent ignored for admin:', event);
      return;
    }
    const userId = opts.anonymous ? this.$config.api?.segment?.anonymousUserId : this.user?.id;
    if (!userId) {
      console.log('trackEvent called but no user in context:', event);
      return;
    }
    await this.analytics.trackEvent(event, userId, properties, this.request);
  }
}

export type LoaderActionHandler<T, R> = (ctx: T) => Promise<R>;

/**
 * A context factory wrapper for Remix's loader and action functions.
 *
 * Handles auth and session management, first priority is via a JWT token,
 * then via a session cookie.
 *
 * The wrapped function will still run even if there is not a user.
 *
 * @param args
 * @param fn
 * @returns
 */
export async function withContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  opts?: { noTokens?: boolean },
) {
  // Try to get analytics from RouterContextProvider (set by middleware)
  // Type assertion needed because context.get is not in the type definition yet
  // TODO: Bring this back in once v8_middleware is supported on vercel
  const analytics = undefined; // (args.context as any)?.get?.(analyticsContext) as AnalyticsContext | undefined;

  const [config, auth, sessionStorage] = await Promise.all([
    getConfig(),
    authenticatorFactory(),
    sessionStorageFactory(),
  ]);
  // Pass analytics to Context constructor if available from middleware
  const ctx = new Context(config, auth, sessionStorage, args.request, analytics);
  await throwOnMinimumCurvenoteClientVersion(ctx, args.request);

  // check for a signature and if valid, add it to the context but allow
  // other auth methods to complete
  const previewToken = new URL(args.request.url).searchParams.get('preview');
  if (previewToken) ctx.verifyPreviewToken(previewToken);

  const token = args.request.headers.get('Authorization');
  if (!opts?.noTokens && token) {
    await ctx.verifyHandshakeToken(token);
    await ctx.verifyCurvenoteSessionToken(token);
    // if this is a curvenote token, this request came from the CLI, we're done
    if (ctx.authorized.curvenote) return ctx;
  }

  const session = await ctx.$sessionStorage.getSession(args.request.headers.get('Cookie'));
  await ctx.verifySession(session);

  return ctx;
}

/**
 * Get a context based on verifying the session cookie alone
 */
export async function getCookieContext(request: Request) {
  const [config, auth, sessionStorage] = await Promise.all([
    getConfig(),
    authenticatorFactory(),
    sessionStorageFactory(),
  ]);
  const ctx = new Context(config, auth, sessionStorage, request);
  const session = await ctx.$sessionStorage.getSession(request.headers.get('Cookie'));
  await ctx.verifySession(session);
  return ctx;
}

/**
 * SecureContext
 *
 * Is a class that extends Context exactly but where the user property is is always defined.
 * It can only be constructed from an existing Context object where the user field is defined.
 *
 * This is useful for functions that need to be secure and where we can ensure that the user
 * is always defined.
 */
export class SecureContext extends Context {
  $user: NonNullable<Context['$user']>;

  get user() {
    return this.$user;
  }

  set user(user: MyUserDBO & { email_verified: boolean }) {
    this.$user = user;
  }

  constructor(ctx: Context) {
    super(ctx.$config, ctx.$auth, ctx.$sessionStorage, ctx.request);
    this.initializeFrom(ctx);
    if (!ctx.user) throw error401();
    this.$user = ctx.user;
  }
}

/**
 * @deprecated Usage of this function should be replaced by specific domain contexts, e.g. admin, site contexts
 *
 * A context factory wrapper for Remix's loader and action functions that checks for specific scopes.
 *
 * This is similar to withWorkContext but without work-specific functionality.
 * It verifies that the user has the required scopes before proceeding.
 *
 * @param args
 * @param scopes Array of required scopes
 * @param fn Handler function
 * @returns
 */
export async function withSecureContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
): Promise<SecureContext> {
  const ctx = await withContext<T>(args, { noTokens: true });

  const secureCtx = new SecureContext(ctx); // checks for user and throws 401 if not defined

  // Check if user has any of the required scopes
  const hasRequiredScope = userHasScopes(secureCtx.user, scopes);
  if (!hasRequiredScope) throw error401(); // should be 403?

  return secureCtx;
}

/**
 * Context wrapper intended for usage in the Remix app to ensure a user is defined and
 * otherwise redirect to login
 */
export async function withAppContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  opts?: { noTokens?: boolean; redirect?: boolean },
) {
  const ctx = await withContext<T>(args, opts);

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

  // Check if user is disabled - treat as authentication failure
  if (ctx.user!.disabled) {
    const session = await ctx.$sessionStorage.getSession(ctx.request.headers.get('Cookie'));
    throwRedirectOr401({
      ...opts,
      redirectTo: '/',
      headers: {
        'Set-Cookie': await ctx.$sessionStorage.destroySession(session),
      },
    });
  }

  // Check if user is pending - redirect to signup flow
  if (ctx.user!.ready_for_approval) {
    throwRedirectOr401({
      ...opts,
      redirectTo: '/awaiting-approval',
    });
  }

  // Check if user is pending - redirect to signup flow
  if (ctx.user!.pending) {
    throwRedirectOr401({
      ...opts,
      redirectTo: '/new-account/pending',
    });
  }

  const secureCtx = new SecureContext(ctx);
  // mark session as verified via cookie
  secureCtx.$verifiedSession = true;
  return secureCtx;
}

/**
 * Context wrapper for app routed that checks for specific scopes
 */
export async function withAppScopedContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  scopes: string[],
): Promise<SecureContext> {
  const ctx = await withAppContext<T>(args);

  if (!userHasScopes(ctx.user, scopes)) {
    const pathname = new URL(args.request.url).pathname;
    console.warn(`User does not have the required scopes (${pathname}): ${scopes.join(', ')}`);
    throw error401();
  }

  return ctx;
}

/**
 * Context wrapper to ensure user has system-level admin scope in the Remix app
 */
export async function withAppAdminContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  opts: { noTokens?: boolean; redirectTo?: string; redirect?: boolean } = {},
): Promise<SecureContext> {
  const ctx = await withAppContext<T>(args, opts);

  if (!hasScopeViaSystemRole(ctx.user.system_role, system.admin)) {
    console.warn(
      'withAppAdminContext',
      args.request.url,
      'user does not have a correct scope on the site',
    );
    throw throwRedirectOr403(opts);
  }

  return ctx;
}

/**
 * Context wrapper to ensure user has platform admin scope in the Remix app
 */
export async function withAppPlatformAdminContext<
  T extends LoaderFunctionArgs | ActionFunctionArgs,
>(args: T, opts: { noTokens?: boolean; redirectTo?: string; redirect?: boolean } = {}) {
  const ctx = await withAppContext<T>(args, opts);

  if (!userHasScope(ctx.user, app.platform.admin) && !userHasScope(ctx.user, system.admin)) {
    console.warn(
      'withAppPlatformAdminContext',
      args.request.url,
      ctx.user.system_role,
      'user does not have a correct scope',
    );
    throw throwRedirectOr403(opts);
  }

  return ctx;
}

/**
 * Context wrapper intended for usage on API endpoints to ensure the user exists with a
 * valid curvenote token
 */
// TODO: rename to withSecureAPIContext & return a SecureContext
export async function withAPISecureContext<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
): Promise<SecureContext> {
  const ctx = await withContext<T>(args);

  if (!ctx.authorized.curvenote) throw error401();

  // Check if user is disabled - treat as authentication failure
  if (ctx.user && ctx.user.disabled) throw error401();

  // Check if user is pending - treat as authentication failure
  if (ctx.user && ctx.user.pending) throw error401();

  return new SecureContext(ctx);
}
