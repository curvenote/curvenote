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

  const loggedInUser = session.get('user');

  const headers = new Headers();

  let authResponse: AuthenticatedUserWithProviderCookie | undefined;
  try {
    authResponse = await ctx.$auth.authenticate('bluesky', args.request);
  } catch (errorOrRedirect: any) {
    if (errorOrRedirect?.status === 302) {
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
        errorOrRedirect?.message ?? 'Could not link Bluesky account. Please try again.';
      const returnTo = session.get('returnTo');
      if (returnTo && typeof returnTo === 'string') {
        session.unset('returnTo');
        headers.append('Set-Cookie', await sessionStorage.commitSession(session));
        const returnToUrl = new URL(returnTo, args.request.url);
        returnToUrl.searchParams.set('error', 'true');
        returnToUrl.searchParams.set('provider', 'bluesky');
        returnToUrl.searchParams.set('message', errorMessage);
        throw redirect(returnToUrl.pathname + returnToUrl.search, { headers });
      }
      console.warn('Bluesky /auth/callback - linking failed, redirecting to linked-accounts');
      const params = new URLSearchParams();
      params.set('error', 'true');
      params.set('provider', 'bluesky');
      params.set('message', errorMessage);
      throw redirect(`/app/settings/linked-accounts?${params.toString()}`, { headers });
    }
    handleCallbackErrorsWithoutCatchingRedirects('bluesky', errorOrRedirect);
  }

  if (!authResponse) {
    throw redirect('/login');
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (loggedInUser) {
    console.log('Bluesky /auth/callback - linking complete');

    if (loggedInUser.ready_for_approval) {
      throw redirect('/awaiting-approval', { headers });
    } else if (loggedInUser.pending) {
      throw redirect('/new-account/check-accounts-linked', { headers });
    }

    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts?linked=bluesky', { headers });
  }

  session.set('user', user);
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));

  const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
  if (returnToUrl) {
    console.log(`Bluesky redirecting to returnTo URL: ${returnToUrl}`);
    throw redirect(returnToUrl, { headers });
  }

  if (user) {
    if (user.ready_for_approval) {
      throw redirect('/awaiting-approval', { headers });
    } else if (user.pending) {
      throw redirect('/new-account/pending', { headers });
    }
  }

  if (!user) {
    console.warn('Bluesky /auth/callback - user not found');
    throw redirect(
      failureRedirectUrl({
        provider: 'bluesky',
        message: `Unable to authenticate with Bluesky (user not found). Please try again or contact support.`,
      }),
      {
        headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
      },
    );
  }

  throw redirect('/app', { headers });
}
