import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../../app/app.js";
import { registry } from "../../../app/plugins/registry.js";
import { makeTestPlugin } from "../../../app/test-plugin.js";

describe("GET /api/v1/services", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("returns empty array when no plugins registered", async () => {
    const res = await app.request("/api/v1/services", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns all registered service manifests", async () => {
    registry.register(makeTestPlugin("alpha"));
    registry.register(makeTestPlugin("beta"));
    const res = await app.request("/api/v1/services", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("alpha");
    expect(body[1].name).toBe("beta");
  });

  it("list items expose manifest fields only", async () => {
    registry.register(makeTestPlugin("checker"));
    const res = await app.request("/api/v1/services", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe("checker");
    expect(body[0].title).toBe("checker Service");
    expect(body[0].actions).toBeUndefined();
  });
});

describe("GET /api/v1/services/:serviceName", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("returns service detail from manifest", async () => {
    registry.register(makeTestPlugin("plagiarism-checker"));
    const res = await app.request("/api/v1/services/plagiarism-checker", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("plagiarism-checker");
    expect(body.title).toBe("plagiarism-checker Service");
    expect(body.metadata).toEqual({});
    expect(body.actions).toBeUndefined();
  });

  it("returns 404 for unknown service", async () => {
    const res = await app.request("/api/v1/services/nonexistent", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nonexistent");
  });
});

describe("POST /api/v1/services/:serviceName/instances/:instanceId/configure", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("returns plugin configure result", async () => {
    registry.register(
      makeTestPlugin("detailer", {
        configure: async (credentials: Record<string, unknown>) => ({
          status: "completed" as const,
          result: { echo: true, hasKey: typeof credentials.apiKey === "string" },
        }),
      }),
    );
    const res = await app.request(
      "/api/v1/services/detailer/instances/detailer/configure",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("completed");
    expect(body.result).toEqual({ echo: true, hasKey: true });
  });
});

describe("POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/trigger-stage", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("returns 400 when phase is missing", async () => {
    registry.register(makeTestPlugin("stager"));
    const res = await app.request(
      "/api/v1/services/stager/instances/stager/check/ext-1/trigger-stage",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("phase");
  });

  it("invokes triggerProcessingStage with phase in body", async () => {
    registry.register(
      makeTestPlugin("stager", {
        triggerProcessingStage: async (_c, externalId, body) => ({
          status: "processing" as const,
          message: "kicked",
          result: { externalId, phase: body.phase },
        }),
      }),
    );
    const res = await app.request(
      "/api/v1/services/stager/instances/stager/check/ext-42/trigger-stage",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phase: "similarity" }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("processing");
    expect(body.result).toEqual({
      externalId: "ext-42",
      phase: "similarity",
    });
  });
});
