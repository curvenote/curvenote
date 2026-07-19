import type { Context } from '../../backend/types.js';
import type { ExtensionCheckHandleActionResult, ServerExtension } from './types.js';

export const DEFAULT_CHECK_MAINTENANCE_MESSAGE = 'Service is temporarily down for maintenance';

export type CheckMaintenanceRecord = {
  enabled: boolean;
  message?: string;
  updatedAt?: string;
  updatedByUserId?: string;
};

export type CheckMaintenanceState = {
  underMaintenance: boolean;
  message: string;
};

export function parseCheckMaintenanceRecord(raw: unknown): CheckMaintenanceRecord | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (record.enabled !== true) return undefined;
  const message =
    typeof record.message === 'string' && record.message.trim() !== ''
      ? record.message.trim()
      : undefined;
  return {
    enabled: true,
    ...(message ? { message } : {}),
    ...(typeof record.updatedAt === 'string' ? { updatedAt: record.updatedAt } : {}),
    ...(typeof record.updatedByUserId === 'string'
      ? { updatedByUserId: record.updatedByUserId }
      : {}),
  };
}

export function parseCheckMaintenanceFromConfig(
  config: Record<string, unknown> | undefined,
): CheckMaintenanceState | undefined {
  if (!config) return undefined;
  const record = parseCheckMaintenanceRecord(config.maintenance);
  if (!record) return undefined;
  return {
    underMaintenance: true,
    message: record.message ?? DEFAULT_CHECK_MAINTENANCE_MESSAGE,
  };
}

export function checkMaintenanceActionError(message?: string): ExtensionCheckHandleActionResult {
  return {
    error: {
      type: 'maintenance',
      message: message ?? DEFAULT_CHECK_MAINTENANCE_MESSAGE,
    },
    status: 503,
  };
}

export function maintenanceGuardFromConfig(
  config: Record<string, unknown>,
): ExtensionCheckHandleActionResult | undefined {
  const state = parseCheckMaintenanceFromConfig(config);
  if (!state) return undefined;
  return checkMaintenanceActionError(state.message);
}

export async function loadCheckMaintenanceByServiceIds(
  ctx: Context,
  extensions: ServerExtension[],
  checkServiceIds: string[],
): Promise<Record<string, CheckMaintenanceState>> {
  const requested = new Set(checkServiceIds);
  if (requested.size === 0) return {};

  const result: Record<string, CheckMaintenanceState> = {};

  await Promise.all(
    extensions.map(async (ext) => {
      const services = ext.getChecks?.() ?? [];
      const matchingIds = services.map((service) => service.id).filter((id) => requested.has(id));
      if (matchingIds.length === 0) return;

      const config = ext.getExtensionConfiguration
        ? await ext.getExtensionConfiguration(ctx)
        : undefined;
      const state = parseCheckMaintenanceFromConfig(config);
      if (!state) return;

      for (const id of matchingIds) {
        result[id] = state;
      }
    }),
  );

  return result;
}

export async function loadCheckMaintenanceByServiceId(
  ctx: Context,
  extensions: ServerExtension[],
  checkServiceId: string,
): Promise<CheckMaintenanceState | undefined> {
  const byId = await loadCheckMaintenanceByServiceIds(ctx, extensions, [checkServiceId]);
  return byId[checkServiceId];
}
