import { waitUntil } from '@vercel/functions';
import { getConfig } from '../../../app-config.server.js';

export function resolveQueueDrainUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/$/, '');
  return `${base}/v1/jobs/push-to-drain`;
}

/**
 * Fire-and-forget wake of POST /v1/jobs/push-to-drain after enqueue.
 * Resolves when 202 is received, not when the job handler completes.
 */
export async function notifyQueueConsumer(): Promise<void> {
  const config = await getConfig();
  const url = resolveQueueDrainUrl(config.api.url);
  const secret = config.api.queueConsumerSecret;

  const promise = fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).then((response) => {
    if (response.status !== 202) {
      console.warn('[queue] push-to-drain wake unexpected status', {
        status: response.status,
        url,
      });
    }
  });

  waitUntil(promise);
  void promise.catch((err) => {
    console.warn('[queue] push-to-drain wake error', { url, err });
  });
}
