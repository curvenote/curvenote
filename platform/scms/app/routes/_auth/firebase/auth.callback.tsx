import { redirect, type LoaderFunctionArgs } from 'react-router';
import {
  withContext,
  sessionStorageFactory,
  failureRedirectUrl,
  getReturnToUrl,
} from '@curvenote/scms-server';

export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withContext(args);

  if (ctx.user) {
    const sessionStorage = await sessionStorageFactory();
    const session = await sessionStorage.getSession(args.request.headers.get('Cookie'));
    const headers = new Headers();

    // If a returnTo URL is set, always honor it (even for pending users).
    const returnToUrl = await getReturnToUrl(session, sessionStorage, headers);
    if (returnToUrl) {
      throw redirect(returnToUrl, { headers });
    }

    if (ctx.user.ready_for_approval) {
      console.log('FIREBASE /auth/callback - redirecting to awaiting-approval');
      throw redirect('/awaiting-approval');
    } else if (ctx.user.pending) {
      console.log('FIREBASE /auth/callback - returning to signup flow');
      throw redirect('/new-account/pending');
    }

    throw redirect('/app');
  }

  throw redirect(
    failureRedirectUrl({
      provider: 'firebase',
      status: 401,
      message: 'No user found',
    }),
  );
}
