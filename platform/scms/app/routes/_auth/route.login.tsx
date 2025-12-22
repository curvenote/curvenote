import type { Route } from './+types/route.login';
import { redirect, Outlet } from 'react-router';
import { error405 } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  if (ctx.user) {
    // If user is disabled, log them out and redirect to home
    if (ctx.user.disabled) {
      const session = await ctx.$sessionStorage.getSession(ctx.request.headers.get('Cookie'));
      throw redirect('/', {
        headers: {
          'Set-Cookie': await ctx.$sessionStorage.destroySession(session),
        },
      });
    }

    if (ctx.user.pending) {
      throw redirect('/new-account/pending');
    }

    if (ctx.user.ready_for_approval) {
      throw redirect('/awaiting-approval');
    }

    // If user is not disabled, redirect to app
    throw redirect('/app');
  }
  return null;
}

export async function action() {
  throw error405();
}

export default function LoginPage() {
  return (
    <div className="flex flex-col justify-center px-4 py-12 space-y-10">
      <Outlet />
    </div>
  );
}
