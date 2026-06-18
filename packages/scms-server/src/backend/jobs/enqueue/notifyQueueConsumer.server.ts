import { waitUntil } from '@vercel/functions';
import { getConfig } from '../../../app-config.server.js';

export function resolveQueueDrainUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/$/, '');
  return `${base}/v1/jobs/push-to-drain`;
}

/**
 * Resolve the drain url to persist in `_JobQueueDrainConfig` — the url that
 * `pg_net` calls from INSIDE the Postgres container (supabase provider).
 *
 * Prefers `api.tasksCallbackUrl` (e.g. `http://host.docker.internal:3031/v1`,
 * which already includes `/v1`) so the wake fired from the container reaches the
 * dev server on the host; falls back to `api.url` for non-Docker setups.
 *
 * This intentionally differs from `resolveQueueDrainUrl`/`notifyQueueConsumer`,
 * which use `api.url` directly because that path is the app calling its own
 * endpoint (the drain chain wake), where `localhost` is correct.
 */
export function resolveStoredQueueDrainUrl(api: {
  url: string;
  tasksCallbackUrl?: string;
}): string {
  if (api.tasksCallbackUrl) {
    return `${api.tasksCallbackUrl.replace(/\/$/, '')}/jobs/push-to-drain`;
  }
  return resolveQueueDrainUrl(api.url);
}

/**
 * Fire-and-forget wake of POST /v1/jobs/push-to-drain.
 *
 * Used for the drain chain wake when backlog remains after draining one message
 * (the app calling its own endpoint). The enqueue wake itself is fired by
 * Postgres — a pg_net trigger on pgmq.q_job — so dispatchJob does not call this.
 *
 * This does NOT await the wake request. The returned promise resolves once the
 * request has been started (config loaded), not when the 202 is received. The
 * actual wake fetch is handed to `waitUntil` so it survives the current
 * invocation, and its outcome is only logged.
 *
 * A failed or slow wake does not surface to the caller: the enqueued job stays
 * in pgmq and runs when the pg_cron backup drains it (up to ~1 minute later).
 * Because of that silent fallback, wake failures are logged at `error` level
 * with a stable marker so systematic breakage (bad secret, wrong url, network)
 * is detectable via log alerts.
 *
 * Callers should treat this as fire-and-forget (`void notifyQueueConsumer()`);
 * awaiting it only blocks on `getConfig()` and gives a false impression of
 * delivery confirmation.
 */
export function notifyQueueConsumer(): void {
  const promise = (async () => {
    const config = await getConfig();
    const url = resolveQueueDrainUrl(config.api.url);
    const secret = config.api.queueConsumerSecret;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      if (response.status !== 202) {
        console.error('[queue] push-to-drain wake failed: unexpected status', {
          status: response.status,
          url,
        });
      }
    } catch (err) {
      console.error('[queue] push-to-drain wake failed: request error', { url, err });
    }
  })();

  waitUntil(promise);
}
