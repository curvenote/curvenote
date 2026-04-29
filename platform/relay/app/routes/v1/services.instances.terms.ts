/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/terms
 */
import type { Context } from "hono";
import { instanceCredentials } from "../../relay-config.js";
import { resolveInstanceForServicePost, splitBody } from "./services.instances.utils.js";

export async function termsPost(c: Context) {
  const resolution = await resolveInstanceForServicePost(c);
  if (!resolution.ok) return resolution.response;

  const { plugin, instance, body } = resolution;
  const { rest } = splitBody(body);

  try {
    const out = await plugin.getTerms(instanceCredentials(instance), rest);
    return c.json(out);
  } catch (error) {
    return c.json(
      {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Terms failed",
        result: null,
      },
      500,
    );
  }
}
