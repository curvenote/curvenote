import { httpError } from '@curvenote/scms-core';
import type { Context } from '../context.server.js';

/**
 * Job URL passed to async workers (Pub/Sub attributes).
 *
 * Defaults to the incoming request origin via `ctx.asApiUrl`. When
 * `api.tasksCallbackUrl` is set (local dev with workers in Docker), uses that
 * base instead so PATCH callbacks reach the host (e.g. host.docker.internal).
 */
export function workerJobUrl(ctx: Context, jobPath: string): string {
  const configured = ctx.$config.api.tasksCallbackUrl;
  if (configured) {
    const base = configured.replace(/\/$/, '');
    const path = jobPath.startsWith('/') ? jobPath : `/${jobPath}`;
    return `${base}${path}`;
  }
  return ctx.asApiUrl(jobPath);
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
