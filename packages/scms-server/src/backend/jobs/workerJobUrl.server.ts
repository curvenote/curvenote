import { httpError } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-core';

/**
 * Absolute v1 API URL for async worker callbacks (Pub/Sub attributes).
 *
 * Prefers `api.tasksCallbackUrl` (local dev with workers in Docker, e.g.
 * host.docker.internal). Otherwise uses `api.url` from app-config — not the
 * incoming request origin, because queue handlers run under a synthetic
 * `http://localhost/internal/jobs/run` context.
 */
export function workerJobUrl(ctx: Context, jobPath: string): string {
  const path = jobPath.startsWith('/') ? jobPath : `/${jobPath}`;
  const configured = ctx.$config.api.tasksCallbackUrl ?? ctx.$config.api.url;
  const base = configured.replace(/\/$/, '');
  return `${base}${path}`;
}

/**
 * Absolute base URL for extension hook notify callbacks (no trailing slash), e.g.
 * `http://localhost:3031/v1/hooks/text-integrity/notify`.
 *
 * Must be set explicitly via extension config (`notifyBaseUrl`). Async job
 * handlers run under a synthetic runHandler request, so callback URLs must not
 * be inferred from request origin or `api.url`.
 */
export function hooksNotifyBaseUrl(hookPath: string, notifyBaseUrl?: string): string {
  const configured = notifyBaseUrl?.trim();
  if (!configured) {
    throw httpError(
      503,
      `Extension notifyBaseUrl is required for hook ${hookPath} (set app.extensions.*.notifyBaseUrl in app-config, e.g. https://host/v1/hooks/${hookPath.replace(/^\//, '')})`,
    );
  }
  return configured.replace(/\/$/, '');
}
