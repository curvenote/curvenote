import { afterEach, describe, expect, it, vi } from "vitest";
import { isHttpAccessLoggingEnabled } from "../app/http-access-log.js";

describe("isHttpAccessLoggingEnabled", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("is true when NODE_ENV is development", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.HTTP_LOG;
    expect(isHttpAccessLoggingEnabled()).toBe(true);
  });

  it("is false in production when HTTP_LOG is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.HTTP_LOG;
    expect(isHttpAccessLoggingEnabled()).toBe(false);
  });

  it("is true in production when HTTP_LOG=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HTTP_LOG", "1");
    expect(isHttpAccessLoggingEnabled()).toBe(true);
  });

  it("is false when HTTP_LOG is 0 or false", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("HTTP_LOG", "0");
    expect(isHttpAccessLoggingEnabled()).toBe(false);
    vi.stubEnv("HTTP_LOG", "false");
    expect(isHttpAccessLoggingEnabled()).toBe(false);
  });
});
