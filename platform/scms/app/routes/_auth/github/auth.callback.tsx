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
    authResponse = await ctx.$auth.authenticate('github', args.request);
  } catch (errorOrRedirect: any) {
    console.warn('GITHUB /auth/callback - linking failed');
    handleCallbackErrorsWithoutCatchingRedirects('github', errorOrRedirect);
  }

  if (!authResponse) {
    throw redirect(
      failureRedirectUrl({
        provider: 'github',
        message: 'Unable to authenticate with GitHub. Please try again or contact support.',
      }),
      { headers: { 'Set-Cookie': await sessionStorage.destroySession(session) } },
    );
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (loggedInUser) {
    console.log('GITHUB /auth/callback - linking complete');
    if (loggedInUser.ready_for_approval) {
      console.log('GITHUB /auth/callback - redirect to /awaiting-approval');
      throw redirect('/awaiting-approval', { headers });
    } else if (loggedInUser.pending) {
      console.log('GITHUB /auth/callback - redirect to /new-account/pending');
      throw redirect('/new-account/pending', { headers });
    }

    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts', { headers });
  }

  if (!user) {
    console.warn('GITHUB /auth/callback - user not found');
    throw redirect(
      failureRedirectUrl({
        provider: 'github',
        message: `Unable to authenticate with GitHub (user not found). Please try again or contact support.`,
      }),
      {
        headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
      },
    );
  }

  session.set('user', user);
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));
  throw redirect('/app', { headers });
}
