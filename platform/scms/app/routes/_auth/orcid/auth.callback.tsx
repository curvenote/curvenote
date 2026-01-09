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
  const initialLoggedInUser = session.get('user');

  const headers = new Headers();

  let authResponse: AuthenticatedUserWithProviderCookie | undefined;
  try {
    authResponse = await ctx.$auth.authenticate('orcid', args.request);
  } catch (errorOrRedirect: any) {
    console.warn('ORCID /auth/callback - linking failed');
    handleCallbackErrorsWithoutCatchingRedirects('orcid', errorOrRedirect);
  }

  const { providerSetCookie, ...user } = authResponse;
  headers.append('Set-Cookie', providerSetCookie);

  if (initialLoggedInUser) {
    // account linking flow
    console.log('ORCID /auth/callback - linking complete');

    if (initialLoggedInUser.ready_for_approval) {
      console.log('ORCID /auth/callback - redirect to /awaiting-approval');
      throw redirect('/awaiting-approval', { headers });
    } else if (initialLoggedInUser.pending) {
      // linking from within the signup flow
      console.log('ORCID /auth/callback - redirect to /new-account/check-accounts-linked');
      throw redirect('/new-account/check-accounts-linked', { headers });
    }

    // Check for returnTo URL and redirect if present
    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    throw redirect('/app/settings/linked-accounts', { headers });
  }

  session.set('user', user);
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));

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
