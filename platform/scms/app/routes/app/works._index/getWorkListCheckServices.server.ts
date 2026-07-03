import {
  getExtensionCheckServicesFromServerConfig,
  isCheckWorkListSummaryVisible,
  type ClientExtensionCheckService,
} from '@curvenote/scms-core';
import { extensions as clientExtensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';

export type WorkListCheckVisibilityService = Pick<
  ClientExtensionCheckService,
  'id' | 'isWorkListSummaryVisible'
>;

/** Enabled check services with work-list visibility predicates (from client extension defs). */
export function getWorkListCheckServices(config: AppConfig): WorkListCheckVisibilityService[] {
  const enabledIds = new Set(
    getExtensionCheckServicesFromServerConfig(config, serverExtensions).map((service) => service.id),
  );
  return clientExtensions
    .flatMap((extension) => extension.getChecks?.() ?? [])
    .filter((service) => enabledIds.has(service.id));
}

export function isWorkListCheckRunVisible(
  checkServices: WorkListCheckVisibilityService[],
  kind: string,
  metadata: unknown,
): boolean {
  const service = checkServices.find((entry) => entry.id === kind);
  return service != null && isCheckWorkListSummaryVisible(service, metadata);
}
