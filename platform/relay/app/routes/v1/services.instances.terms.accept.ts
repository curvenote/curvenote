/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/terms/accept
 */
import type { Context } from "hono";
import { instanceCredentials } from "../../relay-config.js";
import { resolveInstanceForServicePost, splitBody } from "./services.instances.utils.js";

export async function termsAcceptPost(c: Context) {
  const resolution = await resolveInstanceForServicePost(c);
  if (!resolution.ok) return resolution.response;

  const { plugin, instance, body } = resolution;
  if (!plugin.acceptTerms) {
    return c.json(
      {
        status: "error" as const,
        message: "Terms acceptance is not supported for this service",
        result: null,
      },
      501,
    );
  }

  const { rest } = splitBody(body);

  try {
    const out = await plugin.acceptTerms(instanceCredentials(instance), rest);
    return c.json(out);
  } catch (error) {
    return c.json(
      {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Terms accept failed",
        result: null,
      },
      500,
    );
  }
}
