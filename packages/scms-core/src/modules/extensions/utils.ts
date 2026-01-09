import type { ExtensionConfig } from './types.js';

export function getExtensionConfig(
  appConfig: AppConfig,
  extensionId: string,
): ExtensionConfig | undefined {
  return ((appConfig.app.extensions as Record<string, any>) ?? {})[extensionId];
}
