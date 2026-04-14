/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/status
 */
import type { Context } from "hono";
import { instanceCredentials } from "../../relay-config.js";
import {
  resolveInstanceForServicePost,
  splitBody,
} from "./services.instances.utils.js";

export async function checkStatusPost(c: Context) {
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
    const result = await plugin.getCheckStatus(
      instanceCredentials(instance),
      externalId,
      rest,
    );
    return c.json(result ?? { status: "unknown", result: null });
  } catch (error) {
    return c.json(
      {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Status failed",
        result: null,
      },
      500,
    );
  }
}
