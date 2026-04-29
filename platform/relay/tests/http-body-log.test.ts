import { afterEach, describe, expect, it, vi } from "vitest";
import {
  headersForLog,
  isHttpBodyLoggingEnabled,
  redactSensitiveInJson,
  truncateForLog,
} from "../app/http-body-log.js";

describe("headersForLog", () => {
  it("redacts sensitive headers", () => {
    const h = new Headers();
    h.set("Content-Type", "application/json");
    h.set("Authorization", "Bearer secret");
    h.set("X-Custom", "ok");
    const out = headersForLog(h);
    expect(out.authorization).toBe("[REDACTED]");
    expect(out["content-type"]).toBe("application/json");
    expect(out["x-custom"]).toBe("ok");
  });
});

describe("truncateForLog", () => {
  it("returns short text unchanged", () => {
    expect(truncateForLog("hi", 10)).toBe("hi");
  });

  it("truncates long text", () => {
    const s = "a".repeat(20);
    expect(truncateForLog(s, 10)).toMatch(/^aaaaaaaaaa…\(truncated, 20 chars\)$/);
  });
});

describe("redactSensitiveInJson", () => {
  it("redacts known keys", () => {
    const out = redactSensitiveInJson({
      apiKey: "secret",
      nested: { webhookSigningSecret: "x" },
      ok: "visible",
    }) as Record<string, unknown>;
    expect(out.apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).webhookSigningSecret).toBe(
      "[REDACTED]",
    );
    expect(out.ok).toBe("visible");
  });

  it("handles arrays", () => {
    const out = redactSensitiveInJson([{ token: "t" }, 1]) as unknown[];
    expect((out[0] as Record<string, unknown>).token).toBe("[REDACTED]");
    expect(out[1]).toBe(1);
  });
});

describe("isHttpBodyLoggingEnabled", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("is false without HTTP_LOG_BODIES", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.HTTP_LOG_BODIES;
    expect(isHttpBodyLoggingEnabled()).toBe(false);
  });

  it("is true in development when HTTP_LOG_BODIES=1", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HTTP_LOG_BODIES", "1");
    expect(isHttpBodyLoggingEnabled()).toBe(true);
  });

  it("is false in production without HTTP_LOG even if HTTP_LOG_BODIES=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.HTTP_LOG;
    vi.stubEnv("HTTP_LOG_BODIES", "1");
    expect(isHttpBodyLoggingEnabled()).toBe(false);
  });

  it("is true in production when both HTTP_LOG and HTTP_LOG_BODIES are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HTTP_LOG", "1");
    vi.stubEnv("HTTP_LOG_BODIES", "1");
    expect(isHttpBodyLoggingEnabled()).toBe(true);
  });
});
