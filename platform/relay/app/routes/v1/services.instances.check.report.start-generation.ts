/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/start-generation
 */
import type { Context } from "hono";
import { checkScopedJson } from "./services.instances.utils.js";

export function checkReportStartGenerationPost(c: Context) {
  return checkScopedJson(
    c,
    (plugin, externalId, credentials, rest) =>
      plugin.startReportGeneration(credentials, externalId, rest),
  );
}
