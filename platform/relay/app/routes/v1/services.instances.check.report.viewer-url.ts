/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/viewer-url
 */
import type { Context } from "hono";
import { checkScopedJson } from "./services.instances.utils.js";

export function checkReportViewerUrlPost(c: Context) {
  return checkScopedJson(
    c,
    (plugin, externalId, credentials, rest) =>
      plugin.getReportViewerUrl(credentials, externalId, rest),
  );
}
