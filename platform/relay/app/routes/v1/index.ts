import { Hono } from "hono";
import { apiKeyAuth } from "../../middleware/auth.js";
import { services } from "./services.js";
import { ingest } from "./ingest.js";

/**
 * Checks Relay HTTP API version 1. Mounted at `/api/v1` in `app.ts`.
 */
const v1 = new Hono({ strict: false });

/** API root / liveness — no auth (same JSON shape as the former `GET /` on the parent app). */
v1.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "checks-relay",
    timestamp: new Date().toISOString(),
  });
});

v1.use("/services/*", apiKeyAuth);
v1.route("/services", services);
v1.route("/ingest", ingest);

export { v1 };
