/* eslint-disable @typescript-eslint/no-namespace */
import type { Authenticator } from 'remix-auth';
import { Strategy } from 'remix-auth/strategy';
import type { AuthenticatedUser, AuthenticatedUserWithProviderCookie } from '../auth.server.js';
import { getServerAuth } from '../../database/firebase/firebase.server.js';
import { error401, TrackEvent } from '@curvenote/scms-core';
import {
  dbUpsertLinkedUserLinkedAccount,
  dbGetUserById,
  dbUpdateUser,
  failureRedirectUrl,
  provisionNewUserFromEditorAPI,
} from '../common.server.js';
import { getSetProviderCookie } from '../../../cookies.server.js';
import { redirectDocument } from 'react-router';
import { sessionStorageFactory } from '../../../session.server.js';
import {
  AnalyticsContext,
  addSegmentAnalytics,
} from '../../../backend/services/analytics/segment.server.js';

export namespace FirebaseStrategy {
  export interface VerifyOptions {
    idToken: string;
    request: Request;
  }
}

class FirebaseStrategy<User> extends Strategy<User, FirebaseStrategy.VerifyOptions> {
  name = 'firebase';

  constructor(verify: Strategy.VerifyFunction<User, FirebaseStrategy.VerifyOptions>) {
    super(verify);
  }

  async authenticate(request: Request): Promise<User> {
    const form = await request.formData();

    const idToken = form.get('idToken')?.toString();
    if (!idToken) throw error401('Firebase Google provider - no id token');

    return this.verify({ idToken, request });
  }
}

export function registerFirebaseStrategy(
  config: AppConfig,
  auth: Authenticator<AuthenticatedUser>,
) {
  auth.use(
    new FirebaseStrategy<AuthenticatedUser>(async ({ idToken, request }) => {
      const analytics = new AnalyticsContext();
      addSegmentAnalytics(analytics, config.api?.segment);

      const serverAuth = await getServerAuth();
      const claims = await serverAuth.verifyIdToken(idToken);
      const { uid, email, name } = claims;

      const sessionStorage = await sessionStorageFactory();
      const session = await sessionStorage.getSession(request.headers.get('Cookie'));

      if (!uid) throw error401('Firebase Google provider - no uid');
      if (!email) throw error401('Firebase Google provider - no email');

      const fbUser = await serverAuth.getUser(uid);
      const googleProviderData = fbUser.providerData.find((p) => p.providerId === 'google.com');
      // not creating a provider cookie as we don't have google tokens?

      // firebase is special in that we expect the firebase ID to be the primary id of
      // the user
      let dbUser = await dbGetUserById(uid);
      const provider = googleProviderData ? 'google' : 'firebase-email';
      const provisionNewUsers = config.auth?.firebase?.provisionNewUser ?? false;
      if (!dbUser && provisionNewUsers) {
        // We use the editor API to get the user's profile data
        // but we are going to push them into our signup flow anyways
        // this function always sets pending:true and readyForApproval:false
        dbUser = await provisionNewUserFromEditorAPI(
          config,
          {
            uid,
            email,
            provider,
            displayName: fbUser?.displayName ?? name,
          },
          googleProviderData ?? fbUser,
        );

        await analytics.identifyEvent(dbUser);
        await analytics.trackEvent(
          TrackEvent.USER_SIGNED_UP,
          dbUser.id,
          {
            provider: 'firebase',
            method: 'firebase-auth',
            linkedAccountEmail: googleProviderData?.email,
            idAtProvider: googleProviderData?.uid,
            firebaseProvider: provider,
          },
          request,
        );
      } else if (dbUser) {
        if (googleProviderData) {
          try {
            await dbUpsertLinkedUserLinkedAccount('google', dbUser.id, {
              idAtProvider: googleProviderData.uid,
              email: googleProviderData.email,
              profile: googleProviderData,
            });
          } catch (e) {
            console.error('Failed to upsert linked account', e);
          }
        }

        await analytics.identifyEvent(dbUser);
        await analytics.trackEvent(
          TrackEvent.USER_LOGGED_IN,
          dbUser.id,
          {
            provider: 'firebase',
            method: 'firebase-auth',
            linkedAccountEmail: googleProviderData?.email,
            idAtProvider: googleProviderData?.uid,
            firebaseProvider: provider,
          },
          request,
        );
      }

      if (!dbUser) {
        console.warn('FIREBASE provider - user not found');
        throw redirectDocument(
          failureRedirectUrl({
            provider: 'google',
            message: `You are logged into FIREBASE via (${provider}) as ${fbUser?.displayName} (${fbUser?.email}) but that user is not found in the ${config.name}.`,
          }),
          {
            headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
          },
        );
      }

      let providerSetCookie: string | undefined;
      if (provider !== 'firebase-email' && googleProviderData) {
        providerSetCookie = getSetProviderCookie(config.api.authCookieSecret, provider, {
          profile: googleProviderData,
        });
      }

      if (dbUser.primaryProvider == null) {
        // this a migration step to ensure all users have a primary provider
        try {
          await dbUpdateUser(dbUser.id, { primaryProvider: provider });
        } catch (e) {
          console.error('Failed to update primary provider', e);
        }
      }

      await analytics.flush();

      return {
        userId: dbUser.id,
        primaryProvider: dbUser.primaryProvider,
        provider: provider,
        pending: dbUser.pending,
        ready_for_approval: dbUser.ready_for_approval,
        providerSetCookie,
      } as AuthenticatedUserWithProviderCookie;
    }),
  );
}
