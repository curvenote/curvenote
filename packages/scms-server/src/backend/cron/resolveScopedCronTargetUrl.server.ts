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
 * `target_url` is unset. Uses the same API base preference as stored queue
 * drain URLs (`tasksCallbackUrl` for Docker dev, else `api.url`).
 */
export function resolveScopedCronTargetUrl(scope: string, api: CronTargetApiConfig): string {
  const path = parseCronEndpointScopePath(scope);
  if (!path) {
    throw new Error('HTTP cron missing target_url');
  }
  const apiBase = api.tasksCallbackUrl ?? api.url;
  return assertAllowedCronTargetUrl(resolveApiPath(apiBase, path), api);
}
