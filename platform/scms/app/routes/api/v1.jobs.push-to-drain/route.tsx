import { error405 } from '@curvenote/scms-core';
import { drainOneJob, getConfig } from '@curvenote/scms-server';
import { waitUntil } from '@vercel/functions';
import { consumeJobQueueMessage } from '../../../lib/job-queue-consumer.server';
import type { Route } from './+types/route';

export const config = {
  maxDuration: 300,
};

export function loader() {
  throw error405();
}

function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * POST /v1/jobs/push-to-drain — queue drain wake-up (mock + Supabase pgmq).
 *
 * Returns 202 immediately; processes one message (qty=1) in the background via waitUntil.
 * Chains another wake when backlog remains. Secured with Bearer api.queueConsumerSecret.
 */
export async function action(args: Route.ActionArgs) {
  const appConfig = await getConfig();
  const authHeader = args.request.headers.get('Authorization');
  const expected = `Bearer ${appConfig.api.queueConsumerSecret}`;

  if (!authHeader || authHeader !== expected) {
    return unauthorized();
  }

  waitUntil(
    drainOneJob(consumeJobQueueMessage).catch((error) => {
      console.error('[push-to-drain] drain failed', error);
    }),
  );

  return Response.json({ status: 'accepted' }, { status: 202 });
}
