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
    authResponse = await ctx.$auth.authenticate('google', args.request);
  } catch (errorOrRedirect: any) {
    console.warn('GOOGLE /auth/callback - linking failed');
    handleCallbackErrorsWithoutCatchingRedirects('google', errorOrRedirect);
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (loggedInUser) {
    // account linking flow
    console.log('GOOGLE /auth/callback - linking complete');
    if (loggedInUser.ready_for_approval) {
      console.log('GOOGLE /auth/callback - redirecting to awaiting-approval');
      throw redirect('/awaiting-approval');
    } else if (loggedInUser.pending) {
      console.log('GOOGLE /auth/callback - returning to signup flow');
      throw redirect('/new-account/pending', { headers });
    }

    // Check for returnTo URL and redirect if present
    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts', { headers });
  }

  // catch all if no user is found
  if (!user) {
    console.warn('GOOGLE /auth/callback - user not found');
    throw redirect(
      failureRedirectUrl({
        provider: 'google',
        message: `Unable to authenticate with GOOGLE (user not found). Please try again or contact support.`,
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
