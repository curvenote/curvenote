import { describe, it, expect } from "vitest";
import { app } from "../app/app.js";

describe("relay app", () => {
  it("GET / redirects to /api/v1", async () => {
    const res = await app.request("/", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/api/v1");
  });

  it("GET /api/v1 returns API health JSON (no auth)", async () => {
    const res = await app.request("/api/v1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("checks-relay");
    expect(body.timestamp).toBeDefined();
  });

  it("GET /api/v1/ matches same as /api/v1 (strict: false)", async () => {
    const res = await app.request("/api/v1/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("checks-relay");
  });

  it("GET /nonexistent returns 404", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });

  it("GET /api/assets/:service/logo.svg serves copied plugin assets", async () => {
    const res = await app.request("/api/assets/echo/logo.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/svg/);
    const text = await res.text();
    expect(text).toContain("<svg");
  });

  it("GET /assets/:service/logo.svg is not served (use /api/assets for Vercel)", async () => {
    const res = await app.request("/assets/echo/logo.svg");
    expect(res.status).toBe(404);
  });
});
