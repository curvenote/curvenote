import type { Authenticator } from 'remix-auth';
import { OAuth2Strategy } from 'remix-auth-oauth2';
import jwt from 'jsonwebtoken';
import {
  assertLinkedAccount,
  dbCreateUserWithPrimaryLinkedAccount,
  dbDeletePendingUser,
  dbGetUserByEmails,
  dbGetUserByLinkedAccount,
  dbUpdateUserLinkedAccountProfile,
  failureRedirectUrl,
  getProviderDisplayName,
  handleAccountLinking,
} from '../common.server.js';
import { orcid, TrackEvent } from '@curvenote/scms-core';
import { getSetProviderCookie } from '../../../cookies.server.js';
import { redirect } from 'react-router';
import { getServerAuth } from '../../database/firebase/firebase.server.js';
import type { AuthenticatedUser } from '../../../session.server.js';
import { sessionStorageFactory } from '../../../session.server.js';
import { $sendSlackNotification, SlackEventType } from '../../../backend/services/slack.server.js';
import {
  AnalyticsContext,
  addSegmentAnalytics,
} from '../../../backend/services/analytics/segment.server.js';

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
  const primaryEmail = orcid.parseOrcidPrimaryEmail(person);
  const primaryEntry =
    emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.primary) ?? emails[0];
  const name = orcid.parseOrcidPersonName(person);

  return {
    id,
    email: primaryEmail,
    emailVerified: primaryEntry?.verified ?? false,
    emails,
    name: name?.trim() || id,
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
        cookie: {
          name: 'oauth2',
          secure: true,
          sameSite: 'Lax',
          httpOnly: true,
          path: '/',
        },
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
          // Check if this ORCID account is already linked to a different user
          const user = session.get('user');
          if (user && dbUserViaOrcid.id !== user.userId) {
            /**
             * Edge case:
             * ORCID signup can provision a *pending* user with a linked ORCID account.
             * If that flow is abandoned, the ORCID remains "claimed" by an orphan pending user,
             * blocking legitimate account linking later.
             *
             * If we are currently attempting a linking flow (session user exists) and the
             * existing ORCID owner is a pending/orphan user, delete that pending user so the
             * current linking can proceed.
             */
            const isOrphanPendingUser =
              allowLinking &&
              !!user &&
              dbUserViaOrcid.pending &&
              !dbUserViaOrcid.ready_for_approval &&
              dbUserViaOrcid.primaryProvider === 'orcid';

            if (isOrphanPendingUser) {
              console.warn('[ORCID REGISTER] Deleting orphan pending ORCID user to allow linking', {
                orphanUserId: dbUserViaOrcid.id,
                linkingUserId: user.userId,
                orcid: profile.id,
              });
              await dbDeletePendingUser(dbUserViaOrcid.id);
              console.log('delete success');
              dbUserViaOrcid = null;
            } else {
              console.log('redirecting here...');
              // ORCID account is already linked to a different (non-orphan) user
              throw redirect(
                `/app/settings/linked-accounts?error=true&provider=orcid&message=${encodeURIComponent('This ORCID account has already been linked to another account.')}`,
              );
            }
          }

          // If we still have a user via ORCID (login flow), update profile + track login
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
          }
        }

        if (!dbUserViaOrcid) {
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
            // When ORCID provides an email, fail early if that email already has a Curvenote user
            if (profile.email) {
              const email = profile.email.trim();
              const existingUserByEmail = await dbGetUserByEmails([email]);
              if (existingUserByEmail) {
                const existingProvider =
                  existingUserByEmail.primaryProvider ??
                  existingUserByEmail.linkedAccounts?.find((a) => a.pending === false)?.provider ??
                  existingUserByEmail.linkedAccounts?.[0]?.provider ??
                  null;
                const existingProviderLabel = getProviderDisplayName(existingProvider);
                const existingEmailMessage = `An account with this email already exists${
                  existingProviderLabel ? ` (${existingProviderLabel})` : ''
                }. Please sign in with ${
                  existingProviderLabel ?? 'that account'
                }, then you can link your ORCID in settings.`;
                throw redirect(
                  failureRedirectUrl({
                    provider: 'orcid',
                    message: existingEmailMessage,
                  }),
                  {
                    headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
                  },
                );
              }

              // Check if a Firebase Auth user already exists with this email
              // If so, redirect to Firebase login flow
              let firebaseUserExists = false;
              try {
                const serverAuth = await getServerAuth();
                await serverAuth.getUserByEmail(profile.email);
                firebaseUserExists = true;
              } catch (error: any) {
                // If user not found, that's fine - continue with ORCID signup
                if (error?.code === 'auth/user-not-found') {
                  // Continue to create user
                } else {
                  // Other errors - log and continue
                  console.error('Error checking Firebase user:', error);
                }
              }
              if (firebaseUserExists) {
                const existingEmailMessage =
                  'An account with this email already exists. Please sign in with Google, then link your ORCID in settings.';
                throw redirect(
                  failureRedirectUrl({
                    provider: 'firebase',
                    message: existingEmailMessage,
                  }),
                );
              }
            }

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
