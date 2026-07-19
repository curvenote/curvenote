import { getConfig, runDueCronJobs, verifyBearerSecret } from '@curvenote/scms-server';
import { waitUntil } from '@vercel/functions';
import type { Route } from './+types/route';

export const config = {
  maxDuration: 300,
};

export function loader() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
}

/**
 * POST /v1/cron/tick — master cron tick (Postgres pg_cron → app).
 * Verifies Bearer api.cron.secret, then runs due CronJob rows in the background.
 */
export async function action(args: Route.ActionArgs) {
  const appConfig = await getConfig();
  const secret = appConfig.api.cron?.secret ?? '';
  const authHeader = args.request.headers.get('Authorization');

  if (!secret || !verifyBearerSecret(authHeader, secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  waitUntil(
    runDueCronJobs().catch((error) => {
      console.error('[cron/tick] runDueCronJobs failed', error);
    }),
  );

  return Response.json({ status: 'accepted' }, { status: 202 });
}
