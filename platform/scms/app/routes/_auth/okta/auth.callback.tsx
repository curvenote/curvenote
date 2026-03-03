import { redirect, type LoaderFunctionArgs } from 'react-router';
import {
  withContext,
  sessionStorageFactory,
  failureRedirectUrl,
  handleCallbackErrorsWithoutCatchingRedirects,
  getReturnToUrl,
} from '@curvenote/scms-server';
import type { AuthenticatedUserWithProviderCookie } from '@curvenote/scms-server';

export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withContext(args);

  const sessionStorage = await sessionStorageFactory();
  const session = await sessionStorage.getSession(args.request.headers.get('Cookie'));

  // this is the user that was logged in before the OAuth2 flow started
  // this is used to determine if we are in an account linking flow
  const loggedInUser = session.get('user');

  const headers = new Headers();

  let authResponse: AuthenticatedUserWithProviderCookie | undefined;
  try {
    authResponse = await ctx.$auth.authenticate('okta', args.request);
  } catch (errorOrRedirect: any) {
    if (errorOrRedirect?.status === 302) throw errorOrRedirect;
    if (loggedInUser && !loggedInUser.ready_for_approval && !loggedInUser.pending) {
      console.warn('OKTA /auth/callback - linking failed, redirecting to linked-accounts');
      const params = new URLSearchParams();
      params.set('error', 'true');
      params.set('provider', 'okta');
      params.set(
        'message',
        errorOrRedirect?.message ?? 'Could not link OKTA account. Please try again.',
      );
      throw redirect(`/app/settings/linked-accounts?${params.toString()}`, { headers });
    }
    handleCallbackErrorsWithoutCatchingRedirects('okta', errorOrRedirect);
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (loggedInUser) {
    // account linking flow
    console.log('OKTA /auth/callback - linking complete');
    if (loggedInUser.ready_for_approval) {
      console.log('OKTA /auth/callback - redirect to /awaiting-approval');
      throw redirect('/awaiting-approval', { headers });
    } else if (loggedInUser.pending) {
      console.log('OKTA /auth/callback - redirect to /new-account/check-accounts-linked');
      throw redirect('/new-account/check-accounts-linked', { headers });
    }

    // Check for returnTo URL and redirect if present
    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts?linked=okta', { headers });
  }

  session.set('user', user);
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));

  // If a returnTo URL is set, always honor it (even for pending users).
  const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
  if (returnToUrl) {
    throw redirect(returnToUrl, { headers });
  }

  if (user) {
    // login or signup flow
    if (user.ready_for_approval) {
      console.log('OKTA /auth/callback - redirect to /awaiting-approval');
      throw redirect('/awaiting-approval', { headers });
    } else if (user.pending) {
      console.log('OKTA /auth/callback - redirect to /new-account/pending');
      throw redirect('/new-account/pending', { headers });
    }
  }

  // catch all if no user is found
  if (!user) {
    console.warn('OKTA /auth/callback - user not found');
    throw redirect(
      failureRedirectUrl({
        provider: 'okta',
        message: `Unable to authenticate with OKTA (user not found). Please try again or contact support.`,
      }),
      {
        headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
      },
    );
  }

  throw redirect('/app', { headers });
}
