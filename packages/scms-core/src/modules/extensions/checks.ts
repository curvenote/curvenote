import type { ClientDeploymentConfig } from '../../providers/DeploymentProvider.js';
import type {
  ClientExtension,
  ExtensionCheckService,
  ExtensionConfig,
  ServerExtension,
} from './types.js';
import { getExtensionConfig } from './utils.js';

/** Serializable check card fields for upload-page SSR (components resolved client-side). */
export type UploadCheckCardMeta = {
  id: string;
  name: string;
  description: string;
};

/**
 * Whether an extension exposes check services in app config (server).
 * Must stay aligned with `platform/scms/app/root.tsx` capability extraction (`checks === true`).
 */
export function extensionChecksEnabledFromServerConfig(
  extCfg: ExtensionConfig | undefined,
): boolean {
  return extCfg?.checks === true;
}

/**
 * Whether an extension exposes check services in client deployment config.
 * Capabilities are derived from the same `checks === true` flags in root loader.
 */
export function extensionChecksEnabledFromClientConfig(
  extCfg: { capabilities: string[] } | undefined,
): boolean {
  return extCfg?.capabilities?.includes('checks') === true;
}

export function toUploadCheckCardMetas(
  services: Pick<ExtensionCheckService, 'id' | 'name' | 'description'>[],
): UploadCheckCardMeta[] {
  return services.map(({ id, name, description }) => ({ id, name, description }));
}

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
    if (!extensionChecksEnabledFromClientConfig(extCfg) || !ext.getChecks) continue;
    services.push(...ext.getChecks());
  }
  return services;
}

/**
 * Get all check services from enabled extensions from an AppConfig, used server-side.
 */
export function getExtensionCheckServicesFromServerConfig(
  serverConfig: AppConfig,
  extensions: ServerExtension[],
): ExtensionCheckService[] {
  const services: ExtensionCheckService[] = [];
  for (const ext of extensions) {
    const extCfg = getExtensionConfig(serverConfig, ext.id);
    if (!extensionChecksEnabledFromServerConfig(extCfg) || !ext.getChecks) continue;
    services.push(...ext.getChecks());
  }
  return services;
}

/**
 * Get a specific check service by ID from enabled extensions.
 */
export function getExtensionCheckServiceFromServerConfig(
  serverConfig: AppConfig,
  extensions: ServerExtension[],
  checkServiceId: string,
): ExtensionCheckService | undefined {
  const services = getExtensionCheckServicesFromServerConfig(serverConfig, extensions);
  return services.find((service) => service.id === checkServiceId);
}
