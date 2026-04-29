import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "../../app/plugins/registry.js";
import { makeTestPlugin } from "../../app/test-plugin.js";

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it("registers and retrieves a plugin by name", () => {
    const plugin = makeTestPlugin("test-service");
    registry.register(plugin);
    expect(registry.get("test-service")).toBe(plugin);
  });

  it("returns undefined for unknown plugin name", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists all registered plugin manifests", () => {
    registry.register(makeTestPlugin("alpha"));
    registry.register(makeTestPlugin("beta"));
    const manifests = registry.list();
    expect(manifests).toHaveLength(2);
    expect(manifests.map((m) => m.name)).toEqual(
      expect.arrayContaining(["alpha", "beta"]),
    );
  });

  it("returns empty array when no plugins registered", () => {
    expect(registry.list()).toEqual([]);
  });

  it("throws on duplicate plugin name", () => {
    registry.register(makeTestPlugin("duplicate"));
    expect(() => registry.register(makeTestPlugin("duplicate"))).toThrow(
      'Plugin "duplicate" is already registered',
    );
  });

  it("throws when plugin.name does not match manifest.name", () => {
    const plugin = makeTestPlugin("alpha");
    plugin.manifest.name = "beta";
    expect(() => registry.register(plugin)).toThrow(
      'Plugin name "alpha" does not match manifest name "beta"',
    );
  });

  it("has() returns true for registered plugins", () => {
    registry.register(makeTestPlugin("exists"));
    expect(registry.has("exists")).toBe(true);
    expect(registry.has("nope")).toBe(false);
  });

  it("clear() removes all plugins", () => {
    registry.register(makeTestPlugin("a"));
    registry.register(makeTestPlugin("b"));
    registry.clear();
    expect(registry.list()).toEqual([]);
    expect(registry.get("a")).toBeUndefined();
  });
});
