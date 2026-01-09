import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { withContext, handleAuthWithReturnTo } from '@curvenote/scms-server';

export function loader() {
  return redirect('/login');
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withContext(args);
  // Handle authentication with returnTo support
  await handleAuthWithReturnTo(args.request, async () =>
    ctx.$auth.authenticate('okta', args.request),
  );
  return null;
}
