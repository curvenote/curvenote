/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/trigger-stage
 */
import type { Context } from "hono";
import { instanceCredentials } from "../../relay-config.js";
import {
  resolveInstanceForServicePost,
  splitBody,
} from "./services.instances.utils.js";

export async function checkTriggerStagePost(c: Context) {
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

  const phase = rest.phase;
  if (typeof phase !== "string" || phase.trim() === "") {
    return c.json(
      {
        status: "error" as const,
        message: "Missing or invalid field: phase (non-empty string required)",
        result: null,
      },
      400,
    );
  }

  try {
    const out = await plugin.triggerProcessingStage(
      instanceCredentials(instance),
      externalId,
      rest,
    );
    return c.json(out);
  } catch (error) {
    return c.json(
      {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Operation failed",
        result: null,
      },
      500,
    );
  }
}
