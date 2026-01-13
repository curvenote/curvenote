import type { Config } from '@/types/app-config.js';
import type { OktaIdTokenClaims, OktaProfile } from '@curvenote/remix-auth-okta';
import { OktaStrategy } from '@curvenote/remix-auth-okta';
import type { Authenticator } from 'remix-auth';
import jwt from 'jsonwebtoken';
import { error401, TrackEvent } from '@curvenote/scms-core';
import {
  assertLinkedAccount,
  dbCreateUserWithPrimaryLinkedAccount,
  dbGetUserByLinkedAccount,
  dbUpdateUserLinkedAccountProfile,
  failureRedirectUrl,
  handleAccountLinking,
} from '../common.server.js';
import { getSetProviderCookie } from '../../../cookies.server.js';
import { redirect } from 'react-router';
import type { AuthenticatedUserWithProviderCookie } from '../../../session.server.js';
import { sessionStorageFactory } from '../../../session.server.js';
import { $sendSlackNotification, SlackEventType } from '../../../backend/services/slack.server.js';
import {
  AnalyticsContext,
  addSegmentAnalytics,
} from '../../../backend/services/analytics/segment.server.js';

/**
 * Register the Okta authentication strategy.
 *
 * @param config - The application configuration
 * @param authenticator - The authenticator instance
 */
export function registerOktaStrategy(
  config: Config,
  authenticator: Authenticator<AuthenticatedUserWithProviderCookie>,
) {
  authenticator.use(
    new OktaStrategy<AuthenticatedUserWithProviderCookie>(
      {
        oktaDomain: config.auth?.okta?.domain ?? 'INVALID',
        oktaServerName: config.auth?.okta?.serverName,
        clientId: config.auth?.okta?.clientId ?? 'INVALID',
        clientSecret: config.auth?.okta?.clientSecret ?? 'INVALID',
        redirectURI: config.auth?.okta?.redirectUrl ?? 'INVALID',
      },
      async ({ tokens, request }) => {
        const analytics = new AnalyticsContext();
        addSegmentAnalytics(analytics, config.api?.segment);

        const sessionStorage = await sessionStorageFactory();
        const session = await sessionStorage.getSession(request.headers.get('Cookie'));

        const { id_token, access_token } = tokens.data as {
          id_token: string;
          access_token: string;
        };

        // Decode and validate the ID token
        const { sub, exp } = jwt.decode(id_token) as OktaIdTokenClaims;
        if (!sub) throw error401('OKTA provider - no user id (subject)');
        if (1000 * exp < Date.now()) {
          throw redirect(
            failureRedirectUrl({
              provider: 'okta',
              message: 'OKTA provider - id token expired',
            }),
          );
        }

        // Decode and validate the access token
        const { exp: accessExp } = jwt.decode(access_token) as { exp: number };
        if (1000 * accessExp < Date.now()) {
          throw redirect(
            failureRedirectUrl({
              provider: 'okta',
              message: 'OKTA provider - access token expired',
            }),
          );
        }

        // Fetch the user profile from Okta
        let profile;
        try {
          profile = await OktaStrategy.userProfile(access_token, {
            oktaServerName: config.auth?.okta?.serverName,
          });
        } catch (error: any) {
          throw error401(
            `OKTA provider - cannot fetch user profile ${error.message ?? `${error.status} ${error.statusText}`}`,
          );
        }

        // Check if new user provisioning is enabled
        const provisionNewUsers = config.auth?.okta?.provisionNewUser ?? false;
        const allowLinking = config.auth?.okta?.allowLinking ?? false;
        let dbUserViaOkta = await dbGetUserByLinkedAccount('okta', profile.id);

        if (dbUserViaOkta) {
          // Update the user's provider profile
          try {
            const account = assertLinkedAccount('okta', dbUserViaOkta);
            await dbUpdateUserLinkedAccountProfile(account.id, profile);
          } catch (error: any) {
            console.error('OKTA provider - Failed to update linked account profile', error);
            // Track account linking failure
            await analytics.trackEvent(
              TrackEvent.USER_LINKING_FAILED,
              dbUserViaOkta.id,
              {
                provider: 'okta',
                operation: 'update_profile',
                error: error.message || 'Unknown error',
              },
              request,
            );
          }

          await analytics.identifyEvent(dbUserViaOkta);
          await analytics.trackEvent(
            TrackEvent.USER_LOGGED_IN,
            dbUserViaOkta.id,
            {
              provider: 'okta',
              method: 'oauth',
              linkedAccountEmail: profile.email,
              idAtProvider: profile.id,
            },
            request,
          );
        } else if (!dbUserViaOkta) {
          const user = session.get('user');
          if (user && allowLinking) {
            try {
              // link the account
              dbUserViaOkta = await handleAccountLinking('okta', user, {
                idAtProvider: profile.id,
                email: profile.email,
                profile,
              });

              await analytics.identifyEvent(dbUserViaOkta);
              await analytics.trackEvent(
                TrackEvent.USER_LINKED,
                dbUserViaOkta.id,
                {
                  provider: 'okta',
                  method: 'oauth',
                  linkedAccountEmail: profile.email,
                  idAtProvider: profile.id,
                },
                request,
              );
            } catch (error: any) {
              console.error('OKTA provider - Failed to link account', error);
              // Track account linking failure
              await analytics.trackEvent(
                TrackEvent.USER_LINKING_FAILED,
                user.userId,
                {
                  provider: 'okta',
                  operation: 'link_account',
                  error: error.message || 'Unknown error',
                },
                request,
              );
              throw error;
            }
          } else if (provisionNewUsers) {
            // Create a new user and linked account
            dbUserViaOkta = await dbCreateUserWithPrimaryLinkedAccount<OktaProfile>({
              email: profile.email,
              username: profile.preferred_username,
              displayName: profile.name,
              primaryProvider: 'okta',
              profile,
            });
            console.log(
              `OKTA provider - provisioned new user (${profile.name}, ${profile.id}, ${dbUserViaOkta.id})`,
            );
            await $sendSlackNotification(
              {
                eventType: SlackEventType.USER_CREATED,
                message: `New user${dbUserViaOkta.username ? ` *${dbUserViaOkta.username}*` : ''} provisioned via okta`,
                user: dbUserViaOkta,
                metadata: {
                  provider: 'okta',
                  username: dbUserViaOkta.username,
                  displayName: dbUserViaOkta.display_name,
                },
              },
              config.api?.slack,
            );

            await analytics.identifyEvent(dbUserViaOkta);
            await analytics.trackEvent(
              TrackEvent.USER_SIGNED_UP,
              dbUserViaOkta.id,
              {
                provider: 'okta',
                method: 'oauth',
                linkedAccountEmail: profile.email,
                idAtProvider: profile.id,
              },
              request,
            );
          } else if (allowLinking) {
            if (!user) {
              // we are not logged in, so we are in the login flow
              throw redirect(`/link-accounts?provider=okta`);
            }
          }
        }

        if (!dbUserViaOkta) {
          throw redirect(
            failureRedirectUrl({
              provider: 'okta',
              message: `You are logged into OKTA as ${profile.name} (${profile.email}) but that user is not found in the ${config.name}. Please contact support.`,
            }),
            {
              headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
            },
          );
        }

        // Set the provider cookie
        const providerSetCookie = getSetProviderCookie(config.api.authCookieSecret, 'okta', {
          profile,
          // refreshToken: tokens.refreshToken(), TODO - how to retieve refresh token for OKTA?
        });

        await analytics.flush();

        return {
          userId: dbUserViaOkta.id,
          primaryProvider: dbUserViaOkta.primaryProvider ?? 'unknown',
          provider: 'okta',
          pending: dbUserViaOkta.pending,
          ready_for_approval: dbUserViaOkta.ready_for_approval,
          providerSetCookie,
        };
      },
    ),
  );
}
