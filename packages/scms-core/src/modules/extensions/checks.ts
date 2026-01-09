import type { ClientExtension, ExtensionCheckService } from './types.js';
import { getExtensionConfig } from './utils.js';

/**
 * Get all check services from enabled extensions.
 * Filters extensions based on their configuration (extCfg.checks).
 */
export function getExtensionCheckServices(
  appConfig: AppConfig,
  extensions: ClientExtension[],
): ExtensionCheckService[] {
  const services: ExtensionCheckService[] = [];
  for (const ext of extensions) {
    const extCfg = getExtensionConfig(appConfig, ext.id);
    if (!extCfg) continue;
    if (extCfg.checks && ext.getChecks) {
      services.push(...ext.getChecks());
    }
  }
  return services;
}

/**
 * Get a specific check service by ID from enabled extensions.
 */
export function getExtensionCheckService(
  appConfig: AppConfig,
  extensions: ClientExtension[],
  checkServiceId: string,
): ExtensionCheckService | undefined {
  const services = getExtensionCheckServices(appConfig, extensions);
  return services.find((service) => service.id === checkServiceId);
}
