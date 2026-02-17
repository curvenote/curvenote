import type { ClientDeploymentConfig } from '../../providers/DeploymentProvider.js';
import type { ClientExtension, ExtensionCheckService, ServerExtension } from './types.js';
import { getExtensionConfig } from './utils.js';

/**
 * Get all check services from enabled extensions from a ClientDeploymentConfig, used client-side.
 */
export function getExtensionCheckServicesFromClientConfig(
  clientConfig: ClientDeploymentConfig,
  extensions: ClientExtension[],
): ExtensionCheckService[] {
  const services: ExtensionCheckService[] = [];
  for (const ext of extensions) {
    const extCfg = clientConfig.extensions?.[ext.id];
    if (!extCfg) continue;
    if (extCfg.capabilities.includes('checks') && ext.getChecks) {
      services.push(...ext.getChecks());
    }
  }
  return services;
}

/**
 * Get all check services from enabled extensions from an AppConfig, used server-side.
 * Filters extensions based on their configuration (extCfg.checks).
 */
export function getExtensionCheckServicesFromServerConfig(
  serverConfig: AppConfig,
  extensions: ServerExtension[],
): ExtensionCheckService[] {
  const services: ExtensionCheckService[] = [];
  for (const ext of extensions) {
    const extCfg = getExtensionConfig(serverConfig, ext.id);
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
export function getExtensionCheckServiceFromServerConfig(
  serverConfig: AppConfig,
  extensions: ClientExtension[],
  checkServiceId: string,
): ExtensionCheckService | undefined {
  const services = getExtensionCheckServicesFromServerConfig(serverConfig, extensions);
  return services.find((service) => service.id === checkServiceId);
}
