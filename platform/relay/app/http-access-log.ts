/**
 * HTTP access logging (hono/logger) is on in development, off in production
 * unless HTTP_LOG is set to a truthy value (1, true, yes, all).
 *
 * Optional request/response bodies: HTTP_LOG_BODIES=1 when access logging is
 * also enabled — see http-body-log.ts.
 */
export function isHttpAccessLoggingEnabled(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const v = process.env.HTTP_LOG?.toLowerCase();
  if (!v || v === "0" || v === "false" || v === "no") {
    return false;
  }
  return true;
}
