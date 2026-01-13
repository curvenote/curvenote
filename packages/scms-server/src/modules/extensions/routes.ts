import type { ServerExtension, RouteRegistration } from '@curvenote/scms-core';
import { getExtensionConfig } from '@curvenote/scms-core';

/**
 * Get all route registrations from enabled extensions.
 */
export async function registerExtensionRoutes(
  appConfig: AppConfig,
  extensions: ServerExtension[],
): Promise<RouteRegistration[]> {
  const registrations: RouteRegistration[] = [];
  for (const ext of extensions) {
    const extCfg = getExtensionConfig(appConfig, ext.id);
    if (!extCfg) continue;
    if (extCfg.routes && ext.registerRoutes) {
      const extRegistrations = await ext.registerRoutes(appConfig);
      registrations.push(...extRegistrations);
    }
  }

  return registrations;
}
