import { error405 } from '@curvenote/scms-core';
import {
  CronEndpointScopes,
  drainOneJob,
  getConfig,
  isJobQueueDrainPaused,
  verifyBearerSecret,
  verifyEndpointScopedHandshake,
} from '@curvenote/scms-server';
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

function logLocalDrainEvent(message: string, metadata?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(message, metadata);
  }
}

function isAuthorizedDrainRequest(
  authHeader: string | null,
  queueSecret: string,
  appConfig: Awaited<ReturnType<typeof getConfig>>,
): boolean {
  if (queueSecret && verifyBearerSecret(authHeader, queueSecret)) {
    return true;
  }
  try {
    verifyEndpointScopedHandshake(authHeader, appConfig, CronEndpointScopes.JOB_QUEUE_DRAIN);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /v1/jobs/push-to-drain — Supabase pgmq queue drain wake-up.
 *
 * Returns 202 immediately; processes one message (qty=1) in the background via waitUntil.
 * Chains another wake when backlog remains. Secured with Bearer api.queueConsumerSecret
 * or endpoint-scoped handshake (POST:/v1/jobs/push-to-drain).
 */
export async function action(args: Route.ActionArgs) {
  const appConfig = await getConfig();
  const authHeader = args.request.headers.get('Authorization');
  const queueSecret = appConfig.api.queueConsumerSecret ?? '';

  if (!isAuthorizedDrainRequest(authHeader, queueSecret, appConfig)) {
    return unauthorized();
  }

  const paused = await isJobQueueDrainPaused();
  logLocalDrainEvent('[push-to-drain] accepted', { paused });
  if (paused) {
    return Response.json({ status: 'accepted', paused: true }, { status: 202 });
  }

  waitUntil(
    drainOneJob(consumeJobQueueMessage)
      .then((didWork) => {
        logLocalDrainEvent('[push-to-drain] done', { didWork });
      })
      .catch((error) => {
        console.error('[push-to-drain] drain failed', error);
      }),
  );

  return Response.json({ status: 'accepted' }, { status: 202 });
}
