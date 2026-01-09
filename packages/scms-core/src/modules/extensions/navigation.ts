import type { ClientExtension, NavigationRegistration } from './types.js';
import { getExtensionConfig } from './utils.js';

let extensionRegistry: ClientExtension[] = [];

/**
 * Register extensions for navigation discovery.
 * This should be called by the app to register all extensions.
 * Extensions can then discover each other's navigation without direct imports.
 */
export function registerExtensionsForNavigation(extensions: ClientExtension[]): void {
  extensionRegistry = extensions;
}

export async function registerExtensionNavigation(
  appConfig: AppConfig,
  mountPoint: string,
  baseUrl: string,
) {
  const registrations: NavigationRegistration[] = [];

  for (const ext of extensionRegistry) {
    const extCfg = getExtensionConfig(appConfig, ext.id);
    if (!extCfg) continue;
    if (extCfg.navigation) {
      const items = ext.registerNavigation();
      registrations.push(...items);
    }
  }

  // Filter registrations based on current path
  let replace = false;
  const menu = registrations
    .filter((registration) => registration.attachTo === mountPoint)
    .map((reg) => {
      replace = replace || reg.replace;
      return reg.register(baseUrl);
    })
    .flat(1);

  return { replace, menu };
}
