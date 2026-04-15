import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadValidatedConfig } from '@app-config/config';
import { defaultAliases } from '@app-config/node';

/** One configured provider binding (credentials, signing secret, target plugin). */
export type ServiceInstanceConfig = {
  serviceName: string;
  apiKey: string;
  apiUrl: string;
  signingSecret: string;
  integrationName: string;
  integrationVersion: string;
};

export type RelayAppConfig = {
  port: number;
  apiKey: string;
  publicBaseUrl?: string;
  webhookBaseUrl?: string;
  /** Allowed base URLs for notify callbacks (origin-only or origin + path prefix). */
  notifyUrlAllowlist?: string[];
  /** Map keys are service instance ids (URL segment `instances/:instanceId`). */
  instances: Record<string, ServiceInstanceConfig>;
};

const relayRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let loaded: RelayAppConfig | undefined;

/** Loads `.app-config*.yml` under `apps/relay` (use `.yml`, not `.yaml`/`.json`). */
export async function loadRelayConfig(): Promise<RelayAppConfig> {
  if (loaded) {
    return loaded;
  }
  const { fullConfig } = await loadValidatedConfig(
    {
      directory: relayRoot,
      environmentAliases: { ...defaultAliases, stage: 'staging' },
    },
    { directory: relayRoot },
  );
  loaded = fullConfig as RelayAppConfig;
  return loaded;
}

export function relayConfig(): RelayAppConfig {
  if (!loaded) {
    throw new Error('Relay configuration not loaded; call loadRelayConfig() at startup');
  }
  return loaded;
}

export function getInstanceConfig(instanceId: string): ServiceInstanceConfig {
  const cfg = relayConfig();
  const instance = cfg.instances[instanceId];
  if (!instance) {
    throw new Error(`Unknown service instance: "${instanceId}"`);
  }
  return instance;
}

export function instanceCredentials(instance: ServiceInstanceConfig): Record<string, unknown> {
  return {
    apiKey: instance.apiKey,
    apiUrl: instance.apiUrl,
    integrationName: instance.integrationName,
    integrationVersion: instance.integrationVersion,
  };
}
