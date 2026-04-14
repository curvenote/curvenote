/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/fetch
 */
import type { Context } from "hono";
import { instanceCredentials } from "../../relay-config.js";
import {
  resolveInstanceForServicePost,
  splitBody,
} from "./services.instances.utils.js";

export async function checkReportFetchPost(c: Context) {
  const serviceName = c.req.param("serviceName");
  const externalId = c.req.param("externalId");
  if (!serviceName || !externalId) {
    return c.json(
      {
        status: "error" as const,
        message: "Missing service name or externalId",
        result: null,
      },
      400,
    );
  }

  const resolution = await resolveInstanceForServicePost(c);
  if (!resolution.ok) return resolution.response;

  const { plugin, instance, body } = resolution;
  const { rest } = splitBody(body);

  try {
    const out = await plugin.fetchReport(
      instanceCredentials(instance),
      externalId,
      rest,
    );
    if (out.kind === "binary") {
      return new Response(Buffer.from(out.body), {
        status: 200,
        headers: { "Content-Type": out.contentType },
      });
    }
    return c.json(out.response);
  } catch (error) {
    return c.json(
      {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Report failed",
        result: null,
      },
      500,
    );
  }
}
