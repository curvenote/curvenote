import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { withContext, sessionStorageFactory, handleAuthWithReturnTo } from '@curvenote/scms-server';

export function loader() {
  return redirect('/login');
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withContext(args);

  const sessionStorage = await sessionStorageFactory();
  const session = await sessionStorage.getSession(args.request.headers.get('Cookie'));
  const allowLogin = ctx.$config.auth?.bluesky?.allowLogin;
  const adminLogin = ctx.$config.auth?.bluesky?.adminLogin;
  const loggedInUser = session.get('user');
  if (!allowLogin && !adminLogin && !loggedInUser) {
    throw redirect('/login');
  }

  await handleAuthWithReturnTo(args.request, async () =>
    ctx.$auth.authenticate('bluesky', args.request),
  );
  return null;
}
