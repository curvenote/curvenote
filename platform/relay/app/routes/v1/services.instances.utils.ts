import type { Context } from "hono";
import type {
  PluginOperationResult,
  ServicePlugin,
} from "@curvenote/check-plugin-types";
import { registry } from "../../plugins/registry.js";
import type { ServiceInstanceConfig } from "../../relay-config.js";
import { getInstanceConfig, instanceCredentials } from "../../relay-config.js";

export function splitBody(body: Record<string, unknown>): {
  credentials: Record<string, unknown>;
  rest: Record<string, unknown>;
} {
  const { credentials: creds, ...rest } = body;
  const credentials =
    typeof creds === "object" && creds !== null && !Array.isArray(creds)
      ? (creds as Record<string, unknown>)
      : {};
  return { credentials, rest };
}

export async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  try {
    return (await c.req.json()) as Record<string, unknown>;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export type InstanceResolutionSuccess = {
  ok: true;
  serviceName: string;
  instanceId: string;
  plugin: ServicePlugin;
  instance: ServiceInstanceConfig;
  body: Record<string, unknown>;
};

export type InstanceResolution = InstanceResolutionSuccess | { ok: false; response: Response };

/**
 * Loads service instance config from path `instanceId` and ensures it is bound to `serviceName`.
 */
export function resolveInstanceFromParsed(
  c: Context,
  serviceName: string,
  instanceId: string,
  plugin: ServicePlugin,
  body: Record<string, unknown>,
): InstanceResolution {
  if (!instanceId || typeof instanceId !== "string") {
    return {
      ok: false,
      response: c.json(
        { status: "error" as const, message: "Missing service instance id", result: null },
        400,
      ),
    };
  }

  let instance: ServiceInstanceConfig;
  try {
    instance = getInstanceConfig(instanceId);
  } catch {
    return {
      ok: false,
      response: c.json(
        {
          status: "error" as const,
          message: `Unknown service instance: "${instanceId}"`,
          result: null,
        },
        404,
      ),
    };
  }

  if (instance.serviceName !== serviceName) {
    return {
      ok: false,
      response: c.json(
        {
          status: "error" as const,
          message: `Service instance "${instanceId}" is not configured for service "${serviceName}"`,
          result: null,
        },
        400,
      ),
    };
  }

  return { ok: true, serviceName, instanceId, plugin, instance, body };
}

/**
 * Resolves plugin from URL `serviceName`, instance from `instanceId`, and reads JSON body once.
 */
export async function resolveInstanceForServicePost(c: Context): Promise<InstanceResolution> {
  const serviceName = c.req.param("serviceName");
  const instanceId = c.req.param("instanceId");
  if (!serviceName) {
    return {
      ok: false,
      response: c.json(
        { status: "error" as const, message: "Missing service name", result: null },
        400,
      ),
    };
  }

  const plugin = registry.get(serviceName);
  if (!plugin) {
    return {
      ok: false,
      response: c.json(
        {
          status: "error" as const,
          message: `Service "${serviceName}" not found`,
          result: null,
        },
        404,
      ),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(c);
  } catch {
    return {
      ok: false,
      response: c.json(
        { status: "error" as const, message: "Invalid JSON body", result: null },
        400,
      ),
    };
  }

  return resolveInstanceFromParsed(c, serviceName, instanceId ?? "", plugin, body);
}

/**
 * Check-scoped plugin calls: path includes `:externalId`; instance from `:instanceId`.
 */
export async function checkScopedJson(
  c: Context,
  run: (
    plugin: ServicePlugin,
    externalId: string,
    credentials: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => Promise<PluginOperationResult>,
) {
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
    const out = await run(plugin, externalId, instanceCredentials(instance), rest);
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
