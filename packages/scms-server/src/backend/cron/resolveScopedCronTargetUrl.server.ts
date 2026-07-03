import { resolveApiPath } from '../utils.server.js';
import { assertAllowedCronTargetUrl } from './assertAllowedCronTargetUrl.server.js';

type CronTargetApiConfig = Parameters<typeof assertAllowedCronTargetUrl>[1];

function parseCronEndpointScopePath(scope: string): string | null {
  const colonIndex = scope.indexOf(':');
  if (colonIndex <= 0) return null;
  const path = scope.slice(colonIndex + 1).split('?')[0]!;
  return path.startsWith('/') ? path : null;
}

/**
 * Resolve an HTTP cron target from `target_scope` ({METHOD}:{path}) when
 * `target_url` is unset. Uses `api.url` because cron HTTP jobs run from the
 * app process calling its own endpoints (same as notifyQueueConsumer chain-wake).
 * Do not use `tasksCallbackUrl` here — that base is for pg_net/pg_cron inside
 * Docker calling back to the host (see resolveStoredQueueDrainUrl).
 */
export function resolveScopedCronTargetUrl(scope: string, api: CronTargetApiConfig): string {
  const path = parseCronEndpointScopePath(scope);
  if (!path) {
    throw new Error('HTTP cron missing target_url');
  }
  return assertAllowedCronTargetUrl(resolveApiPath(api.url, path), api);
}
