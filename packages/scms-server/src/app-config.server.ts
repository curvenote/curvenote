import type { ConfigLoadingOptions } from '@app-config/config';
import { loadValidatedConfig } from '@app-config/config';

let config: Awaited<ReturnType<typeof loadValidatedConfig>> | null = null;

export async function getConfig(options?: ConfigLoadingOptions): Promise<AppConfig> {
  if (!config) {
    config = await loadValidatedConfig(options);
  }

  return config.fullConfig as unknown as AppConfig;
}
