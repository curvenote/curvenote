import type { ConfigLoadingOptions } from '@app-config/config';
import { loadValidatedConfig } from '@app-config/config';
import { SchemaLoadingOptions } from '@app-config/main';
import path from 'node:path';

let config: Awaited<ReturnType<typeof loadValidatedConfig>> | null = null;

export async function getConfig(
  configOptions?: ConfigLoadingOptions,
  schemaOptions?: SchemaLoadingOptions,
): Promise<AppConfig> {
  const localConfigOptions = {
    ...configOptions,
    directory: process.env.VITE_APP_CONFIG_DIRECTORY
      ? path.resolve(process.cwd(), process.env.VITE_APP_CONFIG_DIRECTORY)
      : undefined,
  };

  const localSchemaOptions = {
    ...schemaOptions,
    directory: process.env.VITE_APP_CONFIG_SCHEMA_DIRECTORY
      ? path.resolve(process.cwd(), process.env.VITE_APP_CONFIG_SCHEMA_DIRECTORY)
      : undefined,
  };

  if (!config) {
    // in production we are expecting this to load without issue from the APP_CONFIG environment variable
    // in development we are relying on the config having been loaded in app/routes.ts
    config = await loadValidatedConfig(localConfigOptions, localSchemaOptions);
  }

  return config.fullConfig as unknown as AppConfig;
}
