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
 * This returns `void` and does NOT await anything. The wake work (config load +
 * fetch) is handed to `waitUntil` so it survives the current invocation, and its
 * outcome is only logged — there is nothing for callers to await.
 *
 * A failed or slow wake does not surface to the caller: the enqueued job stays
 * in pgmq and runs when the pg_cron backup drains it (up to ~30 seconds later).
 * Because of that silent fallback, wake failures are logged at `error` level
 * with a stable marker so systematic breakage (bad secret, wrong url, network)
 * is detectable via log alerts.
 *
 * Callers should treat this as fire-and-forget (`notifyQueueConsumer()`).
 */
export function notifyQueueConsumer(): void {
  const promise = (async () => {
    let url: string | undefined;
    try {
      const config = await getConfig();
      url = resolveQueueDrainUrl(config.api.url);
      const secret = config.api.queueConsumerSecret;

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
      // Covers getConfig() rejecting as well as fetch errors — without this the
      // promise handed to waitUntil would surface as an unhandled rejection, and
      // a config-load failure (the one mode that prevents even forming the url)
      // would go unlogged.
      console.error('[queue] push-to-drain wake failed: request error', { url, err });
    }
  })();

  waitUntil(promise);
}
