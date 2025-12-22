import type { Authenticator } from 'remix-auth';
import { OAuth2Strategy } from 'remix-auth-oauth2';
import type { AuthenticatedUser } from '../auth.server.js';
import jwt from 'jsonwebtoken';
import {
  assertLinkedAccount,
  dbCreateUserWithPrimaryLinkedAccount,
  dbGetUserByLinkedAccount,
  dbUpdateUserLinkedAccountProfile,
  failureRedirectUrl,
  handleAccountLinking,
} from '../common.server.js';
import type { orcid } from '@curvenote/scms-core';
import { getSetProviderCookie } from '../../../cookies.server.js';
import { redirect } from 'react-router';
import { sessionStorageFactory } from '../../../session.server.js';
import { $sendSlackNotification, SlackEventType } from '../../../backend/services/slack.server.js';
import {
  AnalyticsContext,
  addSegmentAnalytics,
} from '../../../backend/services/analytics/segment.server.js';
import { TrackEvent } from '@curvenote/scms-core';

async function getUserPersonInfo(id: string, accessToken: string): Promise<orcid.ORCIDProfile> {
  const resp = await fetch(`https://pub.orcid.org/v3.0/${id}/person`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) {
    throw new Error('Failed to fetch ORCID person info');
  }

  const person = (await resp.json()) as orcid.ORCIDPersonResponse;

  const emails: orcid.ORCIDEmail[] = person.emails?.email ?? [];
  const primaryEmail: orcid.ORCIDEmail | undefined =
    emails.filter((e) => e.primary && e.verified)[0] ??
    emails.filter((e) => e.primary)[0] ??
    emails[0];

  return {
    id,
    email: primaryEmail?.email,
    emailVerified: primaryEmail?.verified ?? false,
    emails,
    name: `${person.name?.['given-names']?.value ?? ''} ${person.name?.['family-name']?.value ?? ''}`,
  };
}

export function registerOrcidStrategy(config: AppConfig, auth: Authenticator<AuthenticatedUser>) {
  auth.use(
    new OAuth2Strategy(
      {
        clientId: config.auth?.orcid?.clientId ?? 'INVALID',
        clientSecret: config.auth?.orcid?.clientSecret ?? 'INVALID',
        authorizationEndpoint: `${config.auth?.orcid?.orcidBaseUrl ?? 'https://orcid.org'}/oauth/authorize`,
        tokenEndpoint: `${config.auth?.orcid?.orcidBaseUrl ?? 'https://orcid.org'}/oauth/token`,
        redirectURI: config.auth?.orcid?.redirectUrl ?? 'INVALID',
        scopes: ['openid', 'email', 'profile'],
      },
      async ({ tokens, request }) => {
        const analytics = new AnalyticsContext();
        addSegmentAnalytics(analytics, config.api?.segment);

        const sessionStorage = await sessionStorageFactory();
        const session = await sessionStorage.getSession(request.headers.get('Cookie'));

        const idPayload = jwt.decode(tokens.idToken()) as {
          sub: string;
          exp: number;
          given_name: string;
          family_name: string;
        };

        // check expiry
        const { exp } = idPayload;
        if (1000 * exp < Date.now()) {
          throw redirect(
            failureRedirectUrl({
              provider: 'orcid',
              message: 'ORCID provider - id token expired',
            }),
          );
        }

        const profile = await getUserPersonInfo(idPayload.sub, tokens.accessToken());

        // lookup the user in the database
        const provisionNewUsers = config.auth?.orcid?.provisionNewUser ?? false;
        const allowLinking = config.auth?.orcid?.allowLinking ?? false;
        let dbUserViaOrcid = await dbGetUserByLinkedAccount('orcid', idPayload.sub);

        if (dbUserViaOrcid) {
          // update profile
          try {
            const account = assertLinkedAccount('orcid', dbUserViaOrcid);
            await dbUpdateUserLinkedAccountProfile(account.id, profile);
          } catch (error: any) {
            console.error('ORCID provider - Failed to update linked account profile', error);
            // Track account linking failure
            await analytics.trackEvent(
              TrackEvent.USER_LINKING_FAILED,
              dbUserViaOrcid.id,
              {
                provider: 'orcid',
                operation: 'update_profile',
                error: error.message || 'Unknown error',
              },
              request,
            );
          }

          await analytics.identifyEvent(dbUserViaOrcid);
          await analytics.trackEvent(
            TrackEvent.USER_LOGGED_IN,
            dbUserViaOrcid.id,
            {
              provider: 'orcid',
              method: 'oauth',
              linkedAccountEmail: profile.email,
              idAtProvider: profile.id,
            },
            request,
          );
        } else if (!dbUserViaOrcid) {
          const user = session.get('user');
          if (user && allowLinking) {
            try {
              // link the account
              dbUserViaOrcid = await handleAccountLinking('orcid', user, {
                idAtProvider: profile.id,
                email: profile.email,
                profile,
              });

              await analytics.identifyEvent(dbUserViaOrcid);
              await analytics.trackEvent(
                TrackEvent.USER_LINKED,
                dbUserViaOrcid.id,
                {
                  provider: 'orcid',
                  method: 'oauth',
                  linkedAccountEmail: profile.email,
                  idAtProvider: profile.id,
                },
                request,
              );
            } catch (error: any) {
              console.error('ORCID provider - Failed to link account', error);
              // Track account linking failure
              await analytics.trackEvent(
                TrackEvent.USER_LINKING_FAILED,
                user.userId,
                {
                  provider: 'orcid',
                  operation: 'link_account',
                  error: error.message || 'Unknown error',
                },
                request,
              );
              throw error;
            }
          } else if (provisionNewUsers) {
            // Create a new user and linked account
            dbUserViaOrcid = await dbCreateUserWithPrimaryLinkedAccount<orcid.ORCIDProfile>({
              email: profile.email,
              username: profile.name.toLocaleLowerCase().replace(/\s/g, '_'),
              displayName: profile.name,
              primaryProvider: 'orcid',
              profile,
            });
            console.log(
              `ORCID provider - provisioned new user (${profile.name}, ${profile.id}, ${dbUserViaOrcid.id})`,
            );
            await $sendSlackNotification(
              {
                eventType: SlackEventType.USER_CREATED,
                message: `New user${dbUserViaOrcid.username ? ` *${dbUserViaOrcid.username}*` : ''} provisioned via orcid`,
                user: dbUserViaOrcid,
                metadata: {
                  provider: 'orcid',
                  username: dbUserViaOrcid.username,
                  displayName: dbUserViaOrcid.display_name,
                },
              },
              config.api?.slack,
            );

            await analytics.identifyEvent(dbUserViaOrcid);
            await analytics.trackEvent(
              TrackEvent.USER_SIGNED_UP,
              dbUserViaOrcid.id,
              {
                provider: 'orcid',
                method: 'oauth',
                linkedAccountEmail: profile.email,
                idAtProvider: profile.id,
              },
              request,
            );
          } else if (allowLinking) {
            if (!user) {
              // we are not logged in, so we are in the login flow
              throw redirect(`/link-accounts?provider=orcid`);
            }
          }
        }

        if (!dbUserViaOrcid) {
          throw redirect(
            failureRedirectUrl({
              provider: 'orcid',
              message: `You are logged into ORCID as ${idPayload.sub} (${idPayload.given_name} ${idPayload.family_name}) but that user is not found in the ${config.name}. To log in as a different user log out of orcid.org and try again.`,
            }),
            {
              headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
            },
          );
        }

        // Set the provider cookie
        const providerSetCookie = getSetProviderCookie(config.api.authCookieSecret, 'orcid', {
          profile,
          refreshToken: tokens.refreshToken(),
        });

        return {
          userId: dbUserViaOrcid.id,
          primaryProvider: dbUserViaOrcid.primaryProvider ?? 'unknown',
          provider: 'orcid',
          pending: dbUserViaOrcid.pending,
          ready_for_approval: dbUserViaOrcid.ready_for_approval,
          providerSetCookie,
        };
      },
    ),
    'orcid',
  );
}
