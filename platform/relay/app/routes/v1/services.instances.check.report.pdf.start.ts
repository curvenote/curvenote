/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/pdf/start
 */
import type { Context } from "hono";
import { checkScopedJson } from "./services.instances.utils.js";

export function checkReportPdfStartPost(c: Context) {
  return checkScopedJson(
    c,
    (plugin, externalId, credentials, rest) => {
      const startPdf = plugin.startReportPdf;
      if (!startPdf) {
        return Promise.resolve({
          status: "error" as const,
          message: "Starting similarity PDF is not supported for this service",
          result: null,
        });
      }
      return startPdf(credentials, externalId, rest);
    },
  );
}
