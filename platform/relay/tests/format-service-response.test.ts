import { describe, it, expect } from "vitest";
import { resolvePublicLogo } from "../app/format-service-response.js";

describe("resolvePublicLogo", () => {
  it("returns logo unchanged when publicBaseUrl is missing or blank", () => {
    expect(resolvePublicLogo("/api/assets/x.svg", undefined)).toBe(
      "/api/assets/x.svg",
    );
    expect(resolvePublicLogo("/api/assets/x.svg", "")).toBe("/api/assets/x.svg");
    expect(resolvePublicLogo("/api/assets/x.svg", "   ")).toBe(
      "/api/assets/x.svg",
    );
  });

  it("leaves already-absolute http(s) logos unchanged", () => {
    expect(
      resolvePublicLogo("https://cdn.example.com/l.svg", "https://relay.com"),
    ).toBe("https://cdn.example.com/l.svg");
    expect(
      resolvePublicLogo("http://cdn.example.com/l.svg", "https://relay.com"),
    ).toBe("http://cdn.example.com/l.svg");
  });

  it("resolves root-relative paths against publicBaseUrl", () => {
    expect(
      resolvePublicLogo(
        "/api/assets/echo/logo.svg",
        "https://relay.example.test",
      ),
    ).toBe("https://relay.example.test/api/assets/echo/logo.svg");
    expect(
      resolvePublicLogo(
        "/api/assets/echo/logo.svg",
        "https://relay.example.test/",
      ),
    ).toBe("https://relay.example.test/api/assets/echo/logo.svg");
  });
});
