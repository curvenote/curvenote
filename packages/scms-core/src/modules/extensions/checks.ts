import type { Context } from '../../backend/types.js';
import type { ClientDeploymentConfig } from '../../providers/DeploymentProvider.js';
import type {
  ClientExtensionCheckService,
  ClientExtension,
  ExtensionCheckService,
  ExtensionConfig,
  ServerExtension,
} from './types.js';
import { getExtensionConfig } from './utils.js';

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

export type CheckRunWithServiceData = {
  data?: unknown | null;
};

export function getCheckServiceRunServiceData(run: CheckRunWithServiceData): unknown {
  return run.data != null && typeof run.data === 'object' && 'serviceData' in run.data
    ? (run.data as { serviceData?: unknown }).serviceData
    : undefined;
}

export function isCheckWorkListSummaryVisible(
  service: Pick<ClientExtensionCheckService, 'isWorkListSummaryVisible'>,
  metadata: unknown,
): boolean {
  return service.isWorkListSummaryVisible?.(metadata) ?? true;
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

/**
 * Resolve upload-page logo URLs from check services that implement `resolveUploadLogoUrl`.
 */
export async function resolveUploadCheckLogoUrls(
  ctx: Context,
  serverConfig: AppConfig,
  extensions: ServerExtension[],
): Promise<Record<string, string | undefined>> {
  const services = getExtensionCheckServicesFromServerConfig(serverConfig, extensions);
  const out: Record<string, string | undefined> = {};
  for (const service of services) {
    if (!service.resolveUploadLogoUrl) continue;
    out[service.id] = await service.resolveUploadLogoUrl(ctx);
  }
  return out;
}

/**
 * Collect optional Design-page loader data from extensions that implement `getDesignLoaderData`.
 */
export async function resolveExtensionDesignLoaderData(
  ctx: Context,
  extensions: ServerExtension[],
): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const ext of extensions) {
    if (!ext.getDesignLoaderData) continue;
    out[ext.id] = await ext.getDesignLoaderData(ctx);
  }
  return out;
}
