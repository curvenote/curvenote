import type { ServicePlugin, ServiceManifest } from "@curvenote/check-plugin-types";

class PluginRegistry {
  private plugins = new Map<string, ServicePlugin>();

  register(plugin: ServicePlugin): void {
    if (plugin.name !== plugin.manifest.name) {
      throw new Error(
        `Plugin name "${plugin.name}" does not match manifest name "${plugin.manifest.name}"`,
      );
    }
    if (this.plugins.has(plugin.name)) {
      throw new Error(
        `Plugin "${plugin.name}" is already registered`,
      );
    }
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): ServicePlugin | undefined {
    return this.plugins.get(name);
  }

  list(): ServiceManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  clear(): void {
    this.plugins.clear();
  }
}

export const registry = new PluginRegistry();
export { PluginRegistry };
