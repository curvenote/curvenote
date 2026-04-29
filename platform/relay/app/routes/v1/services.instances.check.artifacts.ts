/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/artifacts
 */
import type { Context } from "hono";
import { checkScopedJson } from "./services.instances.utils.js";

export function checkArtifactsPost(c: Context) {
  return checkScopedJson(
    c,
    (plugin, externalId, credentials, rest) =>
      plugin.getCheckArtifacts(credentials, externalId, rest),
  );
}
