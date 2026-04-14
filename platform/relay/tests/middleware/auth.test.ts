import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../app/app.js";
import { registry } from "../../app/plugins/registry.js";
import { makeTestPlugin } from "../../app/test-plugin.js";

beforeEach(() => {
  registry.clear();
  registry.register(makeTestPlugin("checker"));
});

describe("API Key Auth Middleware", () => {
  it("allows requests with valid API key", async () => {
    const res = await app.request("/api/v1/services", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    expect(res.status).toBe(200);
  });

  it("rejects requests without Authorization header", async () => {
    const res = await app.request("/api/v1/services");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Missing Authorization");
  });

  it("rejects requests with invalid API key", async () => {
    const res = await app.request("/api/v1/services", {
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid API key");
  });

  it("rejects requests with wrong auth scheme", async () => {
    const res = await app.request("/api/v1/services", {
      headers: { Authorization: "Basic test-api-key" },
    });
    expect(res.status).toBe(401);
  });

  it("does not require auth for GET /api/v1 (API health)", async () => {
    const res = await app.request("/api/v1");
    expect(res.status).toBe(200);
  });

  it("does not require auth for ingest routes", async () => {
    const res = await app.request(
      "/api/v1/ingest/33333333-3333-4333-8333-333333333333",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).not.toBe(401);
  });
});
