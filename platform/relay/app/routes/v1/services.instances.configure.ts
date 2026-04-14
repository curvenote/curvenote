/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/configure
 */
import type { Context } from "hono";
import { relayConfig, instanceCredentials } from "../../relay-config.js";
import { resolveInstanceForServicePost } from "./services.instances.utils.js";

function ingestPublicBaseUrlFromConfig(): string {
  const cfg = relayConfig();
  const base =
    cfg.webhookBaseUrl?.trim() || cfg.publicBaseUrl?.trim() || "";
  if (!base) return "";
  const origin = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${origin}/api/v1/ingest`;
}

export async function configurePost(c: Context) {
  const resolution = await resolveInstanceForServicePost(c);
  if (!resolution.ok) return resolution.response;

  const { plugin, instance, body, instanceId } = resolution;

  try {
    const out = await plugin.configure(instanceCredentials(instance), body, {
      ingestPublicBaseUrl: ingestPublicBaseUrlFromConfig(),
      signingSecret: instance.signingSecret,
      instanceId,
    });
    return c.json(out);
  } catch (error) {
    return c.json(
      {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Configure failed",
        result: null,
      },
      500,
    );
  }
}
