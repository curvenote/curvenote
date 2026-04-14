import type { ServicePlugin } from "@checks-relay/check-plugin-types";
import { registry } from "./registry.js";

/**
 * Load and register plugin packages.
 * Each plugin module must default-export a ServicePlugin.
 */
export async function loadPlugins(
  plugins: ServicePlugin[],
): Promise<void> {
  for (const plugin of plugins) {
    try {
      registry.register(plugin);
      console.log(`Loaded plugin: ${plugin.name}`);
    } catch (error) {
      console.error(
        `Failed to load plugin "${plugin.name}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
