import {
  CronEndpointScopes,
  getConfig,
  promoteScheduledJobs,
  verifyEndpointScopedHandshake,
} from '@curvenote/scms-server';
import { waitUntil } from '@vercel/functions';
import type { Route } from './+types/route';

export const config = {
  maxDuration: 300,
};

export function loader() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
}

/** POST /v1/jobs/promote-scheduled — promote due SCHEDULED jobs to QUEUED and dispatch. */
export async function action(args: Route.ActionArgs) {
  const appConfig = await getConfig();
  try {
    verifyEndpointScopedHandshake(
      args.request.headers.get('Authorization'),
      appConfig,
      CronEndpointScopes.PROMOTE_SCHEDULED,
    );
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  waitUntil(
    promoteScheduledJobs().catch((error) => {
      console.error('[promote-scheduled] failed', error);
    }),
  );

  return Response.json({ status: 'accepted' }, { status: 202 });
}
