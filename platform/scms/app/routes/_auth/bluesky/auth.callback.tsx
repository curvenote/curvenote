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

  const initialLoggedInUser = session.get('user');

  const headers = new Headers();

  let authResponse: AuthenticatedUserWithProviderCookie | undefined;
  try {
    authResponse = await ctx.$auth.authenticate('bluesky', args.request);
  } catch (errorOrRedirect: unknown) {
    console.warn('Bluesky /auth/callback - linking failed');
    handleCallbackErrorsWithoutCatchingRedirects('bluesky', errorOrRedirect);
  }

  if (!authResponse) {
    throw redirect(
      failureRedirectUrl({
        provider: 'bluesky',
        message: `Unable to authenticate with Bluesky. Please try again or contact support.`,
      }),
      { headers: { 'Set-Cookie': await sessionStorage.destroySession(session) } },
    );
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (initialLoggedInUser) {
    console.log('Bluesky /auth/callback - linking complete');

    if (initialLoggedInUser.ready_for_approval) {
      throw redirect('/awaiting-approval', { headers });
    } else if (initialLoggedInUser.pending) {
      throw redirect('/new-account/check-accounts-linked', { headers });
    }

    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts', { headers });
  }

  session.set('user', user);
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));

  if (user) {
    if (user.ready_for_approval) {
      throw redirect('/awaiting-approval', { headers });
    } else if (user.pending) {
      throw redirect('/new-account/pending', { headers });
    }
  }

  throw redirect('/app', { headers });
}
