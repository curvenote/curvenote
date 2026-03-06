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
    authResponse = await ctx.$auth.authenticate('orcid', args.request);
  } catch (errorOrRedirect: any) {
    if (errorOrRedirect?.status === 302) {
      // When strategy redirects to linked-accounts with error (e.g. already linked), send user back to returnTo (e.g. form page) or account setup so they see the toast there
      const location = errorOrRedirect?.headers?.get?.('Location') ?? '';
      const isLinkedAccountsError =
        location.includes('/app/settings/linked-accounts') && location.includes('error=true');
      if (isLinkedAccountsError) {
        const strategyUrl = new URL(location, args.request.url);
        const error = strategyUrl.searchParams.get('error');
        const provider = strategyUrl.searchParams.get('provider');
        const message = strategyUrl.searchParams.get('message');
        const returnTo = session.get('returnTo');
        if (returnTo && typeof returnTo === 'string') {
          // Redirect back to form (or other returnTo page) with error params so toast shows there
          session.unset('returnTo');
          headers.append('Set-Cookie', await sessionStorage.commitSession(session));
          const returnToUrl = new URL(returnTo, args.request.url);
          returnToUrl.searchParams.set('error', error ?? 'true');
          if (provider) returnToUrl.searchParams.set('provider', provider);
          if (message) returnToUrl.searchParams.set('message', message);
          throw redirect(returnToUrl.pathname + returnToUrl.search, { headers });
        }
        if (loggedInUser?.pending) {
          const params = new URLSearchParams();
          if (error) params.set('error', error);
          if (provider) params.set('provider', provider);
          if (message) params.set('message', message);
          throw redirect(`/new-account/pending?${params.toString()}`, { headers });
        }
      }
      throw errorOrRedirect;
    }
    if (loggedInUser && !loggedInUser.ready_for_approval && !loggedInUser.pending) {
      const errorMessage =
        errorOrRedirect?.message ?? 'Could not link ORCID account. Please try again.';
      const returnTo = session.get('returnTo');
      if (returnTo && typeof returnTo === 'string') {
        // Redirect back to form (or other returnTo page) with error params so toast shows there
        session.unset('returnTo');
        headers.append('Set-Cookie', await sessionStorage.commitSession(session));
        const returnToUrl = new URL(returnTo, args.request.url);
        returnToUrl.searchParams.set('error', 'true');
        returnToUrl.searchParams.set('provider', 'orcid');
        returnToUrl.searchParams.set('message', errorMessage);
        throw redirect(returnToUrl.pathname + returnToUrl.search, { headers });
      }
      console.warn('ORCID /auth/callback - linking failed, redirecting to linked-accounts');
      const params = new URLSearchParams();
      params.set('error', 'true');
      params.set('provider', 'orcid');
      params.set('message', errorMessage);
      throw redirect(`/app/settings/linked-accounts?${params.toString()}`, { headers });
    }
    handleCallbackErrorsWithoutCatchingRedirects('orcid', errorOrRedirect);
  }

  if (!authResponse) {
    throw redirect('/login');
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (loggedInUser) {
    // account linking flow
    console.log('ORCID /auth/callback - linking complete');

    if (loggedInUser.ready_for_approval) {
      console.log('ORCID /auth/callback - redirect to /awaiting-approval');
      throw redirect('/awaiting-approval', { headers });
    } else if (loggedInUser.pending) {
      // linking from within the signup flow
      console.log('ORCID /auth/callback - redirect to /new-account/check-accounts-linked');
      throw redirect('/new-account/check-accounts-linked', { headers });
    }

    // Check for returnTo URL and redirect if present
    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts?linked=orcid', { headers });
  }

  session.set('user', user);
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));

  // If a returnTo URL is set, always honor it (even for pending users).
  // This allows inline flows (e.g. forms) to keep users on the originating page.
  const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
  if (returnToUrl) {
    console.log(`ORCID redirecting to returnTo URL: ${returnToUrl}`);
    throw redirect(returnToUrl, { headers });
  }

  if (user) {
    // login or signup flow
    if (user.ready_for_approval) {
      console.log('ORCID /auth/callback - redirect to /awaiting-approval');
      throw redirect('/awaiting-approval', { headers });
    } else if (user.pending) {
      console.log('ORCID /auth/callback - redirect to /new-account/pending');
      throw redirect('/new-account/pending', { headers });
    }
  }

  // catch all if no user is found
  if (!user) {
    console.warn('ORCID /auth/callback - user not found');
    throw redirect(
      failureRedirectUrl({
        provider: 'orcid',
        message: `Unable to authenticate with ORCID (user not found). Please try again or contact support.`,
      }),
      {
        headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
      },
    );
  }

  throw redirect('/app', { headers });
}
