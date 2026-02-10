import type { Authenticator } from 'remix-auth';
import { OAuth2Strategy } from 'remix-auth-oauth2';
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
import { TrackEvent } from '@curvenote/scms-core';

/** GitHub API user response (subset we use). */
export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

async function getGitHubUser(accessToken: string): Promise<GitHubProfile> {
  const resp = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch GitHub user: ${resp.status}`);
  }

  const data = (await resp.json()) as GitHubProfile;
  return {
    id: data.id,
    login: data.login,
    name: data.name ?? data.login,
    email: data.email ?? null,
    avatar_url: data.avatar_url ?? null,
  };
}

export function registerGitHubStrategy(
  config: AppConfig,
  auth: Authenticator<AuthenticatedUserWithProviderCookie>,
) {
  auth.use(
    new OAuth2Strategy(
      {
        clientId: config.auth?.github?.clientId ?? 'INVALID',
        clientSecret: config.auth?.github?.clientSecret ?? 'INVALID',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        redirectURI: config.auth?.github?.redirectUrl ?? 'INVALID',
        scopes: ['user', 'user:email'],
      },
      async ({ tokens, request }) => {
        const analytics = new AnalyticsContext();
        addSegmentAnalytics(analytics, config.api?.segment);

        const sessionStorage = await sessionStorageFactory();
        const session = await sessionStorage.getSession(request.headers.get('Cookie'));

        // GitHub does not return id_token; fetch user from API
        const profile = await getGitHubUser(tokens.accessToken());
        const idAtProvider = String(profile.id);

        const provisionNewUsers = config.auth?.github?.provisionNewUser ?? false;
        const allowLinking = config.auth?.github?.allowLinking ?? false;
        let dbUserViaGithub = await dbGetUserByLinkedAccount('github', idAtProvider);

        if (dbUserViaGithub) {
          const user = session.get('user');
          if (user && dbUserViaGithub.id !== user.userId) {
            throw redirect(
              `/app/settings/linked-accounts?error=true&provider=github&message=${encodeURIComponent('This GitHub account has already been linked to another account.')}`,
            );
          }
          try {
            const account = assertLinkedAccount('github', dbUserViaGithub);
            await dbUpdateUserLinkedAccountProfile(account.id, profile);
          } catch (error: any) {
            console.error('GitHub provider - Failed to update linked account profile', error);
            await analytics.trackEvent(
              TrackEvent.USER_LINKING_FAILED,
              dbUserViaGithub.id,
              {
                provider: 'github',
                operation: 'update_profile',
                error: error.message || 'Unknown error',
              },
              request,
            );
          }

          await analytics.identifyEvent(dbUserViaGithub);
          await analytics.trackEvent(
            TrackEvent.USER_LOGGED_IN,
            dbUserViaGithub.id,
            {
              provider: 'github',
              method: 'oauth',
              linkedAccountEmail: profile.email ?? undefined,
              idAtProvider,
            },
            request,
          );
        } else {
          const user = session.get('user');
          if (user && allowLinking) {
            try {
              dbUserViaGithub = await handleAccountLinking('github', user, {
                idAtProvider,
                email: profile.email ?? undefined,
                profile,
              });

              await analytics.identifyEvent(dbUserViaGithub);
              await analytics.trackEvent(
                TrackEvent.USER_LINKED,
                dbUserViaGithub.id,
                {
                  provider: 'github',
                  method: 'oauth',
                  linkedAccountEmail: profile.email ?? undefined,
                  idAtProvider,
                },
                request,
              );
            } catch (error: any) {
              console.error('GitHub provider - Failed to link account', error);
              await analytics.trackEvent(
                TrackEvent.USER_LINKING_FAILED,
                user.userId,
                {
                  provider: 'github',
                  operation: 'link_account',
                  error: error.message || 'Unknown error',
                },
                request,
              );
              throw error;
            }
          } else if (provisionNewUsers) {
            // Option A: require email for new users (same as ORCID)
            const email = profile.email?.trim();
            if (!email) {
              throw redirect(
                failureRedirectUrl({
                  provider: 'github',
                  message:
                    'GitHub did not provide an email. Please add a public email in your GitHub profile or make your email visible, then try again.',
                }),
                {
                  headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
                },
              );
            }

            const profileForDb = { ...profile, id: idAtProvider };
            dbUserViaGithub = await dbCreateUserWithPrimaryLinkedAccount<typeof profileForDb>({
              email,
              username: (profile.name ?? profile.login).toLocaleLowerCase().replace(/\s/g, '_'),
              displayName: profile.name ?? profile.login,
              primaryProvider: 'github',
              profile: profileForDb,
            });
            console.log(
              `GITHUB provider - provisioned new user (${profile.name ?? profile.login}, ${idAtProvider}, ${dbUserViaGithub.id})`,
            );
            await $sendSlackNotification(
              {
                eventType: SlackEventType.USER_CREATED,
                message: `New user${dbUserViaGithub.username ? ` *${dbUserViaGithub.username}*` : ''} provisioned via github`,
                user: dbUserViaGithub,
                metadata: {
                  provider: 'github',
                  username: dbUserViaGithub.username,
                  displayName: dbUserViaGithub.display_name,
                },
              },
              config.api?.slack,
            );

            await analytics.identifyEvent(dbUserViaGithub);
            await analytics.trackEvent(
              TrackEvent.USER_SIGNED_UP,
              dbUserViaGithub.id,
              {
                provider: 'github',
                method: 'oauth',
                linkedAccountEmail: email,
                idAtProvider,
              },
              request,
            );
          } else if (allowLinking) {
            if (!user) {
              throw redirect(`/link-accounts?provider=github`);
            }
          }
        }

        if (!dbUserViaGithub) {
          throw redirect(
            failureRedirectUrl({
              provider: 'github',
              message: `You are logged into GitHub as ${profile.login} but that user is not found in the ${config.name}. To log in as a different user log out of GitHub and try again.`,
            }),
            {
              headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
            },
          );
        }

        const providerSetCookie = getSetProviderCookie(config.api.authCookieSecret, 'github', {
          profile,
        });

        return {
          userId: dbUserViaGithub.id,
          primaryProvider: dbUserViaGithub.primaryProvider ?? 'unknown',
          provider: 'github',
          pending: dbUserViaGithub.pending,
          ready_for_approval: dbUserViaGithub.ready_for_approval,
          providerSetCookie,
        };
      },
    ),
    'github',
  );
}
