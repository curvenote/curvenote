import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { sessionStorageFactory, withContext, failureRedirectUrl } from '@curvenote/scms-server';

export function loader() {
  return redirect('/login');
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withContext(args);

  const sessionStorage = await sessionStorageFactory();
  const session = await sessionStorage.getSession(args.request.headers.get('Cookie'));
  const headers = new Headers();

  // Store returnTo URL from query string if provided
  const url = new URL(args.request.url);
  const returnTo = url.searchParams.get('returnTo');
  if (returnTo) {
    session.set('returnTo', returnTo);
  }

  const { providerSetCookie, ...user } = await ctx.$auth.authenticate('firebase', args.request);

  if (!user) {
    throw redirect(
      failureRedirectUrl({
        provider: 'firebase',
        message: `Unable to authenticate with FIREBASE (user not found). Please try again or contact support.`,
      }),
      {
        headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
      },
    );
  }

  session.set('user', user);
  // providerSetCookie is conditional as user may have logged in via email/password
  if (user.provider === 'google' && !providerSetCookie) {
    console.error('Firebase provider - google provider used but no providerSetCookie');
  }
  if (providerSetCookie) headers.append('Set-Cookie', providerSetCookie);

  headers.append('Set-Cookie', await sessionStorage.commitSession(session));
  throw redirect('/auth/firebase/callback', { headers });
}
