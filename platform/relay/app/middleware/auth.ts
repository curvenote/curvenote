import { createMiddleware } from "hono/factory";
import { relayConfig } from "../relay-config.js";

/**
 * API key authentication middleware.
 * Validates Authorization: Bearer <key> against app-config (apiKey).
 * Applied to SCMS-facing routes only (not webhook ingestion).
 */
export const apiKeyAuth = createMiddleware(async (c, next) => {
  const apiKey = relayConfig().apiKey;
  if (!apiKey) {
    console.error("apiKey is not set in app-config");
    return c.json({ error: "Server configuration error" }, 500);
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return c.json({ error: "Invalid Authorization header format" }, 401);
  }

  if (token !== apiKey) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  await next();
});
