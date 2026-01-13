import { getPrismaClient } from '../../backend/prisma.server.js';
import { formatDate } from '@curvenote/common';
import { httpError } from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';
import type { UserInfo, UserRecord } from 'firebase-admin/auth';
import { redirect } from 'react-router';
import type { AuthenticatedUser, Session, SessionStorage } from '../../session.server.js';
import { $sendSlackNotification, SlackEventType } from '../../backend/services/slack.server.js';
import { sessionStorageFactory } from '../../session.server.js';

/**
 * Get a user by their ID.
 *
 * @param id - The user ID
 * @returns The user record, including linked accounts
 */
export async function dbGetUserById(id: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findUnique({
    where: { id },
    include: { linkedAccounts: true },
  });
}

/**
 * Get a user by their linked account.
 *
 * @param provider - The provider name (e.g., 'okta')
 * @param idAtProvider - The ID of the user at the provider
 * @returns The user record, including linked accounts
 */
export async function dbGetUserByLinkedAccount(provider: string, idAtProvider: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: {
      linkedAccounts: {
        some: {
          provider,
          idAtProvider,
          pending: false,
        },
      },
    },
    include: {
      linkedAccounts: {
        where: {
          provider,
          idAtProvider,
        },
      },
    },
  });
}

/**
 * Get a user by their email addresses.
 *
 * @param emails - The user's email addresses
 * @returns The user record, including linked accounts
 */
export async function dbGetUserByEmails(emails: string[]) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: {
      email: {
        in: emails,
      },
    },
    include: {
      linkedAccounts: true,
    },
  });
}

/**
 *  Create a new user and linked account in a single transaction.
 *  The linked account is the primary provider.
 *
 * @param id - The user id, if not provided a new id will be generated using uuidv7 (default)
 * @param email - The user's email address
 * @param username - The user's username
 * @param primaryProvider - The provider of the linked account
 * @param displayName - The user's display name
 * @param profile - The profile data from the linked account
 * @param editorUserNoPendingOverride - If true, creates the user without pending status (default: false).
 *   This is used when provisioning users from the editor API who should bypass the pending state.
 *   NOTE: This parameter will likely be removed once we have closer and editor integrations.
 * @returns The new user record
 */
export async function dbCreateUserWithPrimaryLinkedAccount<
  T extends { id?: string; uid?: string },
>({
  id,
  email,
  username,
  primaryProvider,
  displayName,
  profile,
  editorUserNoPendingOverride = false,
}: {
  id?: string;
  email?: string;
  username?: string;
  primaryProvider: string;
  displayName?: string;
  profile: T;
  editorUserNoPendingOverride?: boolean;
}) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();

  const data = editorUserNoPendingOverride
    ? {
        signup: {
          completedAt: timestamp,
          status: 'completed',
          skipReason: 'editor_api',
          steps: {
            agreement: {
              type: 'agreement',
              completed: true,
              accepted: true,
              completedAt: timestamp,
            },
          },
        },
      }
    : { signup: {} };

  return prisma.user.create({
    data: {
      id: id ?? uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      email,
      username,
      display_name: displayName,
      system_role: 'USER',
      primaryProvider,
      pending: editorUserNoPendingOverride ? false : true, // this function create new users, who by definition are pending unless we are provisioning a user from the editor API
      ready_for_approval: false,
      data,
      linkedAccounts: {
        create: [
          {
            id: uuidv7(),
            date_created: timestamp,
            date_modified: timestamp,
            date_linked: timestamp,
            provider: primaryProvider,
            idAtProvider: profile?.id ?? profile?.uid ?? 'invalid',
            email: email,
            profile: profile,
            pending: false,
          },
        ],
      },
    },
    include: {
      linkedAccounts: true,
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
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 *  Create a new user record in the database.
 *
 * @param id - The user id, if not provided a new id will be generated using uuidv7 (default)
 * @param email - The user's email address
 * @param primaryProvider - The provider of the linked account
 * @param displayName - The user's display name
 * @param pending - Whether the user is in pending state for signup flow (default: false)
 * @param readyForApproval - Whether the user is ready for approval (default: false)
 * @param signupData - JSONB data for signup flow progress (default: null)
 * @returns The new user record
 */
export async function dbCreateUser({
  id,
  email,
  username,
  primaryProvider,
  displayName,
  pending = false,
  readyForApproval = false,
  signupData = null,
  externalTimestamp,
}: {
  id?: string;
  email?: string;
  username?: string;
  primaryProvider?: string;
  displayName?: string;
  pending?: boolean;
  readyForApproval?: boolean;
  signupData?: any;
  externalTimestamp?: string;
}) {
  const prisma = await getPrismaClient();
  const timestamp = externalTimestamp ?? new Date().toISOString();
  return prisma.user.create({
    data: {
      id: id ?? uuidv7(),
      // use a single timestamp for created and modified
      date_created: timestamp,
      date_modified: timestamp,
      email,
      username,
      display_name: displayName,
      system_role: 'USER',
      primaryProvider,
      pending,
      ready_for_approval: readyForApproval,
      data: { signup: signupData },
    },
    include: {
      linkedAccounts: true,
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
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Upsert a fully linked (not pending) user linked account in the database.
 * If the linked account already exists, update the profile.
 * If the linked account does not exist, create a new record.
 *
 * @param data - The data for the linked account
 * @param data.userId - The user ID
 * @param data.provider - The provider name (e.g., 'okta')
 * @param data.idAtProvider - The ID of the user at the provider
 * @param data.email - The email address of the user
 * @param data.profile - The profile data from the provider
 * @returns The upserted user linked account record
 */
export async function dbUpsertLinkedUserLinkedAccount(
  provider: string,
  userId: string,
  data: {
    idAtProvider: string;
    email?: string;
    profile: any;
  },
) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();

  return prisma.userLinkedAccount.upsert({
    where: {
      uniqueProviderUserId: {
        provider,
        user_id: userId,
      },
    },
    update: {
      profile: data.profile, // Update the profile when the record exists
      date_modified: timestamp,
    },
    create: {
      id: uuidv7(),
      pending: false,
      date_created: timestamp,
      date_modified: timestamp,
      date_linked: timestamp,
      provider,
      user_id: userId,
      idAtProvider: data.idAtProvider,
      email: data.email,
      profile: data.profile,
    },
  });
}

/**
 * Update a pending user linked account in the database.
 *
 * @param data - The data for the linked account
 * @param data.userId - The user ID
 * @param data.provider - The provider name (e.g., 'okta')
 * @param data.idAtProvider - The ID of the user at the provider
 * @param data.email - The email address of the user
 * @param data.profile - The profile data from the provider
 * @returns The updated user linked account record
 */
export async function dbCompleteLinkForPendingUserLinkedAccount(
  id: string,
  data: {
    idAtProvider: string;
    email?: string;
    profile: Record<string, any>;
  },
) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();

  return prisma.userLinkedAccount.update({
    where: { id },
    data: {
      pending: false,
      date_modified: timestamp,
      date_linked: timestamp,
      idAtProvider: data.idAtProvider,
      email: data.email,
      profile: data.profile, // Update the profile when the record exists
    },
  });
}

/**
 * Update a user record in the database.
 *
 * @param userId - The user ID
 * @param data - The data to update
 * @returns The updated user record
 */
export async function dbUpdateUser(userId: string, data: { primaryProvider: string }) {
  const prisma = await getPrismaClient();
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: { ...data, date_modified: new Date().toISOString() },
  });
}

/**
 * Update the profile of a user linked account.
 *
 * @param linkedAccountId - The linked account ID
 * @param profile - The profile data to update
 * @returns The updated user linked account record
 */
export async function dbUpdateUserLinkedAccountProfile(
  linkedAccountId: string,
  profile: Record<string, any>,
) {
  const prisma = await getPrismaClient();
  return prisma.userLinkedAccount.update({
    where: {
      id: linkedAccountId,
    },
    data: {
      date_modified: formatDate(),
      profile: profile,
    },
  });
}

/**
 * Assert that a user has a linked account with the specified provider.
 *
 * @param provider - The provider name (e.g., 'okta')
 * @param user - The user record
 * @throws If the user does not have a linked account with the specified provider
 */
export function assertLinkedAccount(
  provider: string,
  user: Awaited<ReturnType<typeof dbGetUserById>>,
) {
  const account = user?.linkedAccounts?.find((i) => i.provider === provider);
  if (!account) {
    throw httpError(
      500,
      `Validated a linked account but account details not present for ${provider}`,
    );
  }
  return account;
}

/**
 * Generate a failure redirect URL.
 *
 * @param provider - The provider name (e.g., 'okta')
 * @param error - The error object
 * @returns The failure redirect URL
 */
export function failureRedirectUrl({
  provider,
  error,
  status,
  message,
}: {
  provider: string;
  error?: any;
  status?: number;
  message?: string;
}) {
  const params = new URLSearchParams();
  params.set('error', 'true');
  params.set('provider', provider);
  if (error?.status) params.set('status', error.status);
  else if (status) params.set('status', status.toString());
  else params.set('status', '401');
  if (error?.status) params.set('status', error.status);
  else if (message) params.set('message', message);
  else params.set('message', 'Unable to authenticate. Please try again or contact support.');
  return `/login?${params.toString()}`;
}

/**
 * Provision a new user from the editor API.
 *
 * @param config - The application configuration
 * @param data - The user data
 * @param providerData - The provider data
 * @returns The new user record
 */
export async function provisionNewUserFromEditorAPI(
  config: AppConfig,
  data: {
    uid: string;
    email?: string;
    displayName: string;
    provider?: string;
  },
  providerData?: UserInfo | UserRecord, // TODO generalize and use this provision in all modules
) {
  const { uid, email, provider, displayName } = data;

  // we need to call back to the editorApi to get the user's profile
  const resp = await fetch(`${config.api.editorApiUrl}/users/${uid}`);

  // just username for now
  let editorUserProfile: { username?: string; displayName?: string; email?: string };
  if (!resp.ok) {
    console.error(`User not found (Editor API) ${resp.status} ${resp.statusText}`);
    // we are not going to throw a fatal error here, just continue with the
    // information we have
    throw redirect('/new-account/pending');
  } else {
    editorUserProfile = await resp.json();
  }

  let user: Awaited<ReturnType<typeof dbCreateUser>>;

  if (providerData && data.provider === 'google') {
    user = await dbCreateUserWithPrimaryLinkedAccount<Exclude<typeof providerData, undefined>>({
      id: uid,
      email,
      username: editorUserProfile.username,
      displayName: editorUserProfile.displayName ?? displayName,
      primaryProvider: 'google',
      profile: providerData,
      editorUserNoPendingOverride: true,
    });
  } else {
    const timestamp = new Date().toISOString();
    user = await dbCreateUser({
      id: uid,
      email: email,
      username: editorUserProfile.username,
      displayName: editorUserProfile.displayName ?? displayName,
      primaryProvider: provider,
      pending: false,
      readyForApproval: false,
      signupData: {
        completedAt: timestamp,
        status: 'completed',
        skipReason: 'editor_api',
        steps: {
          agreement: {
            type: 'agreement',
            completed: true,
            accepted: true,
            completedAt: timestamp,
          },
        },
      },
    });
  }
  await $sendSlackNotification(
    {
      eventType: SlackEventType.USER_CREATED,
      message: `New user${user.username ? ` *${user.username}*` : ''} provisioned${provider ? ` via ${provider}` : ''}`,
      user,
      metadata: {
        provider,
        username: editorUserProfile.username,
        displayName: editorUserProfile.displayName ?? displayName,
      },
    },
    config.api?.slack,
  );
  return user;
}

/**
 * Handle account linking.
 *
 * @param provider - The provider name (e.g., 'okta')
 * @param sessionUser - The authenticated user
 * @param profile - The profile data from the provider
 * @param opts - Additional options
 * @param opts.defaultToPrimary - True to set the linked account as the primary provider
 * @throws If the user is not logged in
 * @throws If the user does not have a pending linked account
 * @throws If the link request is not recent
 */
export async function handleAccountLinking(
  provider: string,
  sessionUser: AuthenticatedUser,
  data: { idAtProvider: string; email?: string; profile: Record<string, any> },
  opts?: { defaultToPrimary?: boolean },
) {
  const { idAtProvider, email, profile } = data;
  // if we are logged in (via session cookie), then we are attempting to link a an account
  if (sessionUser) {
    // and if my user has a pending linked google account, we'll allow it
    const dbUser = await dbGetUserById(sessionUser.userId);
    if (!dbUser) {
      throw httpError(500, `User not found while linking ${provider} account`);
    }
    const linkedAccount = dbUser?.linkedAccounts.find((account) => account.provider === provider);
    if (linkedAccount?.pending) {
      // finalise the linked account
      await dbCompleteLinkForPendingUserLinkedAccount(linkedAccount.id, {
        idAtProvider,
        email,
        profile,
      });
      if (opts?.defaultToPrimary && dbUser.primaryProvider == null) {
        await dbUpdateUser(dbUser.id, { primaryProvider: provider });
      }
      console.log(
        `${provider} provider - updated pending linked account (${dbUser?.id}, ${data.idAtProvider})`,
      );
      return dbUser;
    }
  }
  throw redirect(`/link-accounts?provider=${provider}`);
}

/**
 * Handle callback errors without catching redirects.
 *
 * @param errorOrRedirect - The error or redirect object
 * @throws If the error is a redirect
 */
export function handleCallbackErrorsWithoutCatchingRedirects(
  provider: string,
  errorOrRedirect: any,
): never {
  if (errorOrRedirect.status === 302) throw errorOrRedirect;
  const searchParams = new URLSearchParams();
  searchParams.set('error', 'true');
  searchParams.set('provider', provider);
  searchParams.set(
    'message',
    errorOrRedirect.message ?? errorOrRedirect.statusText ?? 'No error message provided',
  );
  if (errorOrRedirect.status) searchParams.set('status', errorOrRedirect.status);
  throw redirect(`/auth-error?${searchParams.toString()}`);
}

/**
 * Helper to handle returnTo functionality in auth actions.
 * Stores returnTo in session and intercepts the OAuth redirect to include the updated session cookie.
 *
 * @param request - The incoming request
 * @param authenticateFn - The authenticate function to call
 * @returns Never returns normally, always throws a redirect
 */
export async function handleAuthWithReturnTo(
  request: Request,
  authenticateFn: () => Promise<any>,
): Promise<never> {
  const sessionStorage = await sessionStorageFactory();
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));

  // Store returnTo URL from query string if provided
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo');

  if (returnTo) {
    session.set('returnTo', returnTo);
    const setCookieHeader = await sessionStorage.commitSession(session);

    // Catch the redirect from authenticate and add the session cookie
    try {
      await authenticateFn();
    } catch (response) {
      // authenticate throws a redirect response
      if (response instanceof Response) {
        // Clone the response and add our session cookie
        throw new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'Set-Cookie': setCookieHeader,
          },
        });
      }
      throw response;
    }
  } else {
    await authenticateFn();
  }

  // This should never be reached as authenticate always throws
  throw new Error('Unexpected: authenticate did not throw');
}

/**
 * Helper to handle returnTo redirect in auth callbacks.
 * Checks for returnTo in session and redirects if present.
 *
 * @param session - The session object
 * @param sessionStorage - The session storage
 * @param headers - The headers object to append cookies to
 * @returns The returnTo URL if found, null otherwise
 */
export async function getReturnToUrl(
  session: Session,
  sessionStorage: SessionStorage,
  headers: Headers,
): Promise<string | null> {
  const returnTo = session.get('returnTo');
  if (returnTo && typeof returnTo === 'string') {
    session.unset('returnTo');
    headers.append('Set-Cookie', await sessionStorage.commitSession(session));
    return returnTo;
  }
  return null;
}
