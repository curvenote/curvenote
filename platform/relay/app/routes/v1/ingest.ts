import { Hono } from "hono";
import type { Context } from "hono";
import type { RelayNotifyEnvelope } from "@checks-relay/check-relay-types";
import {
  WebhookSignatureInvalidError,
  type IngestInstanceConfig,
  type WebhookRequest,
  type WebhookVerifyRequest,
} from "@checks-relay/check-plugin-types";
import { registry } from "../../plugins/registry.js";
import { getInstanceConfig, instanceCredentials } from "../../relay-config.js";

const ingest = new Hono({ strict: false });

function buildHeadersAndQuery(c: Context): {
  headers: Record<string, string>;
  query?: Record<string, string[]>;
} {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const query = c.req.queries();
  return {
    headers,
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}

function buildWebhookVerifyRequest(
  c: Context,
  rawBody: string,
): WebhookVerifyRequest {
  const { headers, query } = buildHeadersAndQuery(c);
  return { headers, rawBody, query };
}

function buildWebhookRequest(
  c: Context,
  body: unknown,
  rawBody: string,
): WebhookRequest {
  const { headers, query } = buildHeadersAndQuery(c);
  return { headers, body, rawBody, query };
}

function buildIngestInstanceConfig(
  instanceId: string,
  instance: { serviceName: string; signingSecret: string },
): IngestInstanceConfig {
  return {
    instanceId,
    serviceName: instance.serviceName,
    signingSecret: instance.signingSecret,
  };
}

function nowIso() {
  return new Date().toISOString();
}

async function postNotify(notifyUrl: string, envelope: RelayNotifyEnvelope) {
  return fetch(notifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * POST /api/v1/ingest/:instanceId
 *
 * Stateless webhook handler. The `instanceId` path segment maps to a service instance config
 * which provides the signing secret and plugin routing.
 * Check context (clientId, notifyUrl) is recovered by the plugin from provider metadata.
 */
async function handleIngest(
  c: Context,
  instanceId: string,
): Promise<Response> {
  let instance;
  try {
    instance = getInstanceConfig(instanceId);
  } catch {
    return c.json({ error: `Unknown service instance: "${instanceId}"` }, 404);
  }

  const plugin = registry.get(instance.serviceName);
  if (!plugin) {
    return c.json(
      { error: `Service "${instance.serviceName}" not found` },
      404,
    );
  }

  const rawBody = await c.req.text();
  const ingestInstance = buildIngestInstanceConfig(instanceId, instance);
  const verifyRequest = buildWebhookVerifyRequest(c, rawBody);

  try {
    await plugin.verifyWebhook(verifyRequest, ingestInstance);
  } catch (err) {
    if (err instanceof WebhookSignatureInvalidError) {
      return c.json({ error: "Invalid webhook signature" }, 401);
    }
    console.error(
      "Webhook verification failed:",
      err instanceof Error ? err.message : err,
    );
    return c.json({ error: "Webhook verification failed" }, 500);
  }

  let body: unknown;
  try {
    body = rawBody.length === 0 ? null : JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const webhookRequest = buildWebhookRequest(c, body, rawBody);

  let update;
  try {
    update = await plugin.parseWebhook(webhookRequest, ingestInstance);
  } catch (err) {
    console.error("Webhook processing failed:", err instanceof Error ? err.message : err);
    return c.json({ error: "Webhook processing failed" }, 500);
  }

  if (!update.externalId) {
    return c.json(
      { error: "Plugin did not return externalId from webhook" },
      400,
    );
  }

  if (!update.notifyUrl) {
    console.warn(`No notifyUrl recovered from webhook metadata for ${update.externalId}`);
    return c.json({ received: true, forwarded: false });
  }

  const clientId = update.clientId ?? "unknown";
  const notifyUrl = update.notifyUrl;

  try {
    const base = {
      check_id: update.externalId,
      client_id: clientId,
      service_name: instance.serviceName,
      occurred_at: nowIso(),
    };

    let notifyEnvelopes: RelayNotifyEnvelope[];

    if (plugin.handleIngestWebhook) {
      const fromPlugin = await plugin.handleIngestWebhook({
        request: webhookRequest,
        instance: ingestInstance,
        parsed: update,
        credentials: instanceCredentials(instance),
        occurredAtIso: base.occurred_at,
      });
      notifyEnvelopes = fromPlugin as unknown as RelayNotifyEnvelope[];
    } else {
      notifyEnvelopes = [];
    }

    if (notifyEnvelopes.length === 0) {
      if (update.status === "completed") {
        notifyEnvelopes.push({
          event: "UPLOAD_COMPLETE",
          ...base,
          payload: { upload_status: "COMPLETE" },
        });
      } else if (update.status === "error" || update.status === "failed") {
        notifyEnvelopes.push({
          event: "UPLOAD_FAILED",
          ...base,
          payload: {
            upload_status: "ERROR",
            error_message: update.message ?? "Upload failed",
          },
        });
      } else {
        notifyEnvelopes.push({
          event: "UPLOAD_PENDING",
          ...base,
          payload: { upload_status: "PENDING" },
        });
      }
    }

    for (const env of notifyEnvelopes) {
      const notifyRes = await postNotify(notifyUrl, env);
      if (!notifyRes.ok) {
        console.error(
          `Notify forwarding failed for ${update.externalId}: ${notifyRes.status}`,
        );
      }
    }
  } catch (error) {
    console.error(
      `Notify forwarding error for ${update.externalId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  return c.json({ received: true });
}

ingest.post("/:instanceId", (c) =>
  handleIngest(c, c.req.param("instanceId")),
);

ingest.post("/:instanceId/:uniqueId", (c) =>
  handleIngest(c, c.req.param("instanceId")),
);

export { ingest };
