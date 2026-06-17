import { waitUntil } from '@vercel/functions';
import { getConfig } from '../../../app-config.server.js';

export function resolveQueueDrainUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/$/, '');
  return `${base}/v1/jobs/push-to-drain`;
}

/**
 * Fire-and-forget wake of POST /v1/jobs/push-to-drain.
 *
 * Used for the app-driven wake paths: enqueue under the mock provider (no
 * database/pg_net locally) and the drain chain wake when backlog remains. The
 * supabase provider instead wakes via a pg_net trigger on enqueue
 * (`wakesOnEnqueue`), so dispatchJob does not call this for that path.
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
