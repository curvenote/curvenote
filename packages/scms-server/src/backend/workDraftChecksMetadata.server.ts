import type { ServerExtension } from '@curvenote/scms-core';
import { getExtensionCheckServicesFromServerConfig } from '@curvenote/scms-core';

/**
 * Initial work version `metadata` for new file-upload drafts: all deployment-enabled check services on.
 * Used when creating a draft work (`dbCreateDraftFileWork`) or draft work version (`dbCreateDraftWorkVersion`).
 */
export function metadataForNewDraftFileWorkVersion(
  appConfig: AppConfig,
  serverExtensions: ServerExtension[],
): Record<string, unknown> {
  const services = getExtensionCheckServicesFromServerConfig(appConfig, serverExtensions);
  if (services.length === 0) {
    return { checks: {} };
  }
  return {
    checks: {
      enabled: services.map((s) => s.id),
    },
  };
}
