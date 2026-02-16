import type { Authenticator } from 'remix-auth';
import { Strategy } from 'remix-auth/strategy';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { JoseKey } from '@atproto/jwk-jose';
import { randomBytes } from 'node:crypto';
import { redirect } from 'react-router';
import {
  assertLinkedAccount,
  dbCreateUserWithPrimaryLinkedAccount,
  dbGetUserByLinkedAccount,
  dbUpdateUserLinkedAccountProfile,
  failureRedirectUrl,
  handleAccountLinking,
} from '../common.server.js';
import { getSetProviderCookie } from '../../../cookies.server.js';
import type { AuthenticatedUserWithProviderCookie } from '../../../session.server.js';
import { sessionStorageFactory } from '../../../session.server.js';
import { $sendSlackNotification, SlackEventType } from '../../../backend/services/slack.server.js';
import {
  AnalyticsContext,
  addSegmentAnalytics,
} from '../../../backend/services/analytics/segment.server.js';
import { TrackEvent } from '@curvenote/scms-core';
import { blueskyStateStore, blueskySessionStore } from './stores.server.js';
import type { BlueskyProfile, BlueskyProviderConfig } from './types.js';
import { getBlueskyClientMetadata } from './metadata.server.js';

let cachedClient: NodeOAuthClient | null = null;

function getBlueskyConfig(config: AppConfig): BlueskyProviderConfig | null {
  const bluesky = config.auth?.bluesky;
  if (!bluesky?.clientId || !bluesky?.redirectUrl) return null;
  return {
    clientId: bluesky.clientId,
    redirectUrl: bluesky.redirectUrl,
    jwksUri: bluesky.jwksUri,
    privateKeyPem: bluesky.privateKeyPem,
    displayName: bluesky.displayName,
    allowLogin: bluesky.allowLogin ?? true,
    provisionNewUser: bluesky.provisionNewUser ?? false,
    allowLinking: bluesky.allowLinking ?? false,
    adminLogin: bluesky.adminLogin ?? false,
    pdsHostname: bluesky.pdsHostname ?? 'bsky.social',
  };
}

async function createBlueskyClient(
  providerConfig: BlueskyProviderConfig,
): Promise<NodeOAuthClient> {
  const clientMetadata = getBlueskyClientMetadata(providerConfig) as Record<string, unknown> & {
    client_id: string;
    redirect_uris: string[];
    scope: string;
    grant_types: string[];
    response_types: string[];
    dpop_bound_access_tokens: boolean;
    token_endpoint_auth_method?: string;
    token_endpoint_auth_signing_alg?: string;
    jwks_uri?: string;
  };

  const keyset =
    providerConfig.privateKeyPem &&
    (await Promise.all([JoseKey.fromImportable(providerConfig.privateKeyPem, 'key1')]));

  const client = new NodeOAuthClient({
    clientMetadata,
    keyset: keyset ?? undefined,
    stateStore: blueskyStateStore as any,
    sessionStore: blueskySessionStore as any,
  });

  return client;
}

async function getBlueskyClient(config: AppConfig): Promise<NodeOAuthClient | null> {
  const providerConfig = getBlueskyConfig(config);
  if (!providerConfig) return null;
  if (!cachedClient) {
    cachedClient = await createBlueskyClient(providerConfig);
  }
  return cachedClient;
}

/**
 * Returns the JWKS from the cached Bluesky OAuth client (for the jwks_uri route).
 * Call after registerBlueskyStrategy has been called and bluesky is configured.
 */
export function getBlueskyJwks(): Readonly<{ keys: readonly unknown[] }> | null {
  if (!cachedClient) return null;
  return cachedClient.jwks ?? null;
}

export { getBlueskyClientMetadata };

async function getProfileFromSession(session: { did: string }): Promise<BlueskyProfile> {
  const agent = new Agent(session as any);
  const res = await agent.getProfile({ actor: session.did });
  const data = res?.data;
  return {
    did: session.did,
    handle: data?.handle,
    displayName: data?.displayName,
    avatar: data?.avatar,
  };
}

type BlueskyVerifyParams = {
  profile: BlueskyProfile;
  did: string;
  request: Request;
};

class BlueskyStrategy extends Strategy<AuthenticatedUserWithProviderCookie, BlueskyVerifyParams> {
  name = 'bluesky';

  constructor(
    private client: NodeOAuthClient,
    private providerConfig: BlueskyProviderConfig,
    private appConfig: AppConfig,
    verify: (params: BlueskyVerifyParams) => Promise<AuthenticatedUserWithProviderCookie>,
  ) {
    super(verify);
  }

  async authenticate(request: Request): Promise<AuthenticatedUserWithProviderCookie> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (code && state) {
      const params = new URLSearchParams(url.search);
      const { session } = await this.client.callback(params);
      const profile = await getProfileFromSession(session);
      const did = session.did;
      return this.verify({ profile, did, request });
    }

    const stateToken = randomBytes(32).toString('base64url');
    await (blueskyStateStore as any).set(stateToken, { state: stateToken });
    const loginHint = this.providerConfig.pdsHostname ?? 'bsky.social';
    const redirectUrl = await this.client.authorize(loginHint, { state: stateToken });
    throw redirect(redirectUrl.toString());
  }
}

export async function registerBlueskyStrategy(
  config: AppConfig,
  auth: Authenticator<AuthenticatedUserWithProviderCookie>,
): Promise<void> {
  const providerConfig = getBlueskyConfig(config);
  if (!providerConfig || !providerConfig.privateKeyPem) {
    return;
  }

  const client = await createBlueskyClient(providerConfig);
  cachedClient = client;
  auth.use(
    new BlueskyStrategy(client, providerConfig, config, async ({ profile, did, request }) => {
      const analytics = new AnalyticsContext();
      addSegmentAnalytics(analytics, config.api?.segment);

      const sessionStorage = await sessionStorageFactory();
      const session = await sessionStorage.getSession(request.headers.get('Cookie'));

      const provisionNewUsers = providerConfig.provisionNewUser ?? false;
      const allowLinking = providerConfig.allowLinking ?? false;
      const idAtProvider = did;

      let dbUserViaBluesky = await dbGetUserByLinkedAccount('bluesky', idAtProvider);

      if (dbUserViaBluesky) {
        const user = session.get('user');
        if (user && dbUserViaBluesky.id !== user.userId) {
          throw redirect(
            `/app/settings/linked-accounts?error=true&provider=bluesky&message=${encodeURIComponent('This Bluesky account has already been linked to another account.')}`,
          );
        }
        try {
          const account = assertLinkedAccount('bluesky', dbUserViaBluesky);
          await dbUpdateUserLinkedAccountProfile(account.id, profile as Record<string, any>);
        } catch (error: any) {
          console.error('Bluesky provider - Failed to update linked account profile', error);
          await analytics.trackEvent(
            TrackEvent.USER_LINKING_FAILED,
            dbUserViaBluesky.id,
            {
              provider: 'bluesky',
              operation: 'update_profile',
              error: error?.message || 'Unknown error',
            },
            request,
          );
        }

        await analytics.identifyEvent(dbUserViaBluesky);
        await analytics.trackEvent(
          TrackEvent.USER_LOGGED_IN,
          dbUserViaBluesky.id,
          {
            provider: 'bluesky',
            method: 'oauth',
            idAtProvider,
          },
          request,
        );
      } else {
        const user = session.get('user');
        if (user && allowLinking) {
          try {
            dbUserViaBluesky = await handleAccountLinking('bluesky', user, {
              idAtProvider,
              email: undefined,
              profile: profile as Record<string, any>,
            });

            await analytics.identifyEvent(dbUserViaBluesky);
            await analytics.trackEvent(
              TrackEvent.USER_LINKED,
              dbUserViaBluesky.id,
              {
                provider: 'bluesky',
                method: 'oauth',
                idAtProvider,
              },
              request,
            );
          } catch (error: any) {
            console.error('Bluesky provider - Failed to link account', error);
            await analytics.trackEvent(
              TrackEvent.USER_LINKING_FAILED,
              user.userId,
              {
                provider: 'bluesky',
                operation: 'link_account',
                error: error?.message || 'Unknown error',
              },
              request,
            );
            throw error;
          }
        } else if (provisionNewUsers) {
          const displayName = profile.displayName ?? profile.handle ?? profile.did;
          const username = (profile.handle ?? profile.did)
            .replace(/\./g, '_')
            .toLowerCase()
            .slice(0, 32);
          const profileForDb = { ...profile, id: idAtProvider };

          dbUserViaBluesky = await dbCreateUserWithPrimaryLinkedAccount<typeof profileForDb>({
            email: undefined,
            username: username || `bluesky_${idAtProvider.slice(-8)}`,
            displayName,
            primaryProvider: 'bluesky',
            profile: profileForDb,
          });
          console.log(
            `Bluesky provider - provisioned new user (${displayName}, ${idAtProvider}, ${dbUserViaBluesky.id})`,
          );
          await $sendSlackNotification(
            {
              eventType: SlackEventType.USER_CREATED,
              message: `New user${dbUserViaBluesky.username ? ` *${dbUserViaBluesky.username}*` : ''} provisioned via bluesky`,
              user: dbUserViaBluesky,
              metadata: {
                provider: 'bluesky',
                username: dbUserViaBluesky.username,
                displayName: dbUserViaBluesky.display_name,
              },
            },
            config.api?.slack,
          );

          await analytics.identifyEvent(dbUserViaBluesky);
          await analytics.trackEvent(
            TrackEvent.USER_SIGNED_UP,
            dbUserViaBluesky.id,
            {
              provider: 'bluesky',
              method: 'oauth',
              idAtProvider,
            },
            request,
          );
        } else if (allowLinking) {
          if (!user) {
            throw redirect(`/link-accounts?provider=bluesky`);
          }
        }
      }

      if (!dbUserViaBluesky) {
        throw redirect(
          failureRedirectUrl({
            provider: 'bluesky',
            message: `You are logged into Bluesky as ${profile.handle ?? profile.did} but that user is not found. To log in as a different user log out of Bluesky and try again.`,
          }),
          {
            headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
          },
        );
      }

      const providerSetCookie = getSetProviderCookie(config.api.authCookieSecret, 'bluesky', {
        profile,
      });

      return {
        userId: dbUserViaBluesky.id,
        primaryProvider: dbUserViaBluesky.primaryProvider ?? 'unknown',
        provider: 'bluesky',
        pending: dbUserViaBluesky.pending,
        ready_for_approval: dbUserViaBluesky.ready_for_approval,
        providerSetCookie,
      };
    }),
    'bluesky',
  );
}
