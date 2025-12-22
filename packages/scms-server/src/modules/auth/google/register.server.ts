import type { GoogleProfile } from '@curvenote/remix-auth-google';
import { GoogleStrategy } from '@curvenote/remix-auth-google';
import type { Authenticator } from 'remix-auth';
import type { AuthenticatedUserWithProviderCookie } from '../auth.server.js';
import { getSetProviderCookie } from '../../../cookies.server.js';
import {
  assertLinkedAccount,
  dbCreateUserWithPrimaryLinkedAccount,
  dbGetUserByLinkedAccount,
  dbUpdateUserLinkedAccountProfile,
  failureRedirectUrl,
  handleAccountLinking,
} from '../common.server.js';
import type { firebase } from '@curvenote/scms-core';
import jwt from 'jsonwebtoken';
import { redirect } from 'react-router';
import { sessionStorageFactory } from '../../../session.server.js';
import { $sendSlackNotification, SlackEventType } from '../../../backend/services/slack.server.js';
import {
  AnalyticsContext,
  addSegmentAnalytics,
} from '../../../backend/services/analytics/segment.server.js';
import { TrackEvent } from '@curvenote/scms-core';

function convertGoogleProfileToFirebaseGoogleProfile(
  profile: GoogleProfile,
): firebase.FirebaseProfile {
  return {
    uid: profile.id,
    name: profile.displayName,
    displayName: profile.displayName,
    email: profile.emails[0].value,
    photoURL: profile.photos[0].value,
    emailVerified: true,
  };
}

export function registerGoogleStrategy(
  config: AppConfig,
  auth: Authenticator<AuthenticatedUserWithProviderCookie>,
) {
  auth.use(
    new GoogleStrategy(
      {
        clientId: config.auth?.google?.clientId ?? 'INVALID',
        clientSecret: config.auth?.google?.clientSecret ?? 'INVALID',
        redirectURI: config.auth?.google?.redirectUrl ?? 'INVALID',
        prompt: 'select_account',
        accessType: 'offline',
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
              provider: 'google',
              message: 'GOOGLE provider - id token expired',
            }),
          );
        }

        // get the google profile
        const providerProfile: GoogleProfile = await GoogleStrategy.userProfile(
          tokens.accessToken(),
        );
        const profile = convertGoogleProfileToFirebaseGoogleProfile(providerProfile);

        // lookup the user
        const provisionNewUsers = config.auth?.google?.provisionNewUser ?? false;
        const allowLinking = config.auth?.google?.allowLinking ?? false;
        let dbUserViaGoogle = await dbGetUserByLinkedAccount('google', providerProfile.id);

        if (dbUserViaGoogle) {
          try {
            // update the user's provider profile
            const account = assertLinkedAccount('google', dbUserViaGoogle);
            await dbUpdateUserLinkedAccountProfile(account.id, profile);
          } catch (error: any) {
            console.error('Google provider - Failed to update linked account profile', error);
            // Track account linking failure
            await analytics.trackEvent(
              TrackEvent.USER_LINKING_FAILED,
              dbUserViaGoogle.id,
              {
                provider: 'google',
                operation: 'update_profile',
                error: error.message || 'Unknown error',
              },
              request,
            );
          }

          await analytics.identifyEvent(dbUserViaGoogle);
          await analytics.trackEvent(
            TrackEvent.USER_LOGGED_IN,
            dbUserViaGoogle.id,
            {
              provider: 'google',
              method: 'oauth',
              linkedAccountEmail: profile.email,
              idAtProvider: profile.uid,
            },
            request,
          );
        } else if (!dbUserViaGoogle && allowLinking) {
          // if we are logged in (via session cookie), then we are attempting to link a google account
          const user = session.get('user');
          if (!user) {
            // we are not logged in, so we are in the login flow
            throw redirect(`/link-accounts?provider=google`);
          }
          try {
            // link the account
            dbUserViaGoogle = await handleAccountLinking(
              'google',
              user,
              { idAtProvider: profile.uid, email: profile.email, profile },
              { defaultToPrimary: true },
            );

            await analytics.identifyEvent(dbUserViaGoogle);
            await analytics.trackEvent(
              TrackEvent.USER_LINKED,
              dbUserViaGoogle.id,
              {
                provider: 'google',
                method: 'oauth',
                linkedAccountEmail: profile.email,
                idAtProvider: profile.uid,
              },
              request,
            );
          } catch (error: any) {
            console.error('Google provider - Failed to link account', error);
            // Track account linking failure
            await analytics.trackEvent(
              TrackEvent.USER_LINKING_FAILED,
              user.userId,
              {
                provider: 'google',
                operation: 'link_account',
                error: error.message || 'Unknown error',
              },
              request,
            );
            throw error;
          }
        } else if (!dbUserViaGoogle) {
          if (provisionNewUsers) {
            // Create a new user and linked account
            // NOTE: this will provision new google accounts independent of firebase and the EditorAPI
            // to create accounts bsed on EditorAPI curvenote accounts use teh firebase provider
            dbUserViaGoogle = await dbCreateUserWithPrimaryLinkedAccount<firebase.FirebaseProfile>({
              email: profile.email,
              username: profile.displayName.toLocaleLowerCase().replace(/\s/g, '_'),
              displayName: profile.name,
              primaryProvider: 'google',
              profile,
            });
            console.log(
              `GOOGLE provider - provisioned new user (${profile.name}, ${profile.uid}, ${dbUserViaGoogle.id})`,
            );
            await $sendSlackNotification(
              {
                eventType: SlackEventType.USER_CREATED,
                message: `New user${dbUserViaGoogle.username ? ` *${dbUserViaGoogle.username}*` : ''} provisioned via google`,
                user: dbUserViaGoogle,
                metadata: {
                  provider: 'google',
                  username: dbUserViaGoogle.username,
                  displayName: dbUserViaGoogle.display_name,
                },
              },
              config.api?.slack,
            );

            await analytics.identifyEvent(dbUserViaGoogle);
            await analytics.trackEvent(
              TrackEvent.USER_SIGNED_UP,
              dbUserViaGoogle.id,
              {
                provider: 'google',
                method: 'oauth',
                linkedAccountEmail: profile.email,
                idAtProvider: profile.uid,
              },
              request,
            );
          }
        }

        if (!dbUserViaGoogle) {
          console.warn('GOOGLE /auth/callback - user not found');
          throw redirect(
            failureRedirectUrl({
              provider: 'google',
              message: `You are logged into GOOGLE as ${profile.displayName} (${profile.email}) but that user is not found in the ${config.name}.`,
            }),
            {
              headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
            },
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { photoURL, ...noPhotoUrlProfile } = profile; // if it is a data uri, it will be too long
        const providerSetCookie = getSetProviderCookie(config.api.authCookieSecret, 'google', {
          profile: noPhotoUrlProfile,
          // refreshToken: tokens.refreshToken(), // TODO refresh token, probable needs strategy modification
        });

        return {
          userId: dbUserViaGoogle.id,
          primaryProvider: dbUserViaGoogle.primaryProvider ?? 'unknown',
          provider: 'google',
          pending: dbUserViaGoogle.pending,
          ready_for_approval: dbUserViaGoogle.ready_for_approval,
          providerSetCookie,
        };
      },
    ),
  );
}
