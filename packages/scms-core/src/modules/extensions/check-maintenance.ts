import type { Context } from '../../backend/types.js';
import type { ExtensionCheckHandleActionResult, ServerExtension } from './types.js';
import { getExtensionCheckServicesFromServerConfig } from './checks.js';

export const DEFAULT_CHECK_MAINTENANCE_MESSAGE =
  'This service is temporarily unavailable for maintenance.';

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

export function getConfiguredCheckServiceIds(
  serverConfig: AppConfig,
  extensions: ServerExtension[],
): string[] {
  return getExtensionCheckServicesFromServerConfig(serverConfig, extensions).map((s) => s.id);
}

export async function loadCheckMaintenanceByServiceId(
  ctx: Context,
  extensions: ServerExtension[],
  checkServiceId: string,
): Promise<CheckMaintenanceState | undefined> {
  for (const ext of extensions) {
    const services = ext.getChecks?.() ?? [];
    if (!services.some((service) => service.id === checkServiceId)) continue;
    const config = ext.getExtensionConfiguration
      ? await ext.getExtensionConfiguration(ctx)
      : undefined;
    return parseCheckMaintenanceFromConfig(config);
  }
  return undefined;
}

export async function loadCheckMaintenanceByServiceIds(
  ctx: Context,
  extensions: ServerExtension[],
  checkServiceIds: string[],
): Promise<Record<string, CheckMaintenanceState>> {
  const entries = await Promise.all(
    checkServiceIds.map(async (id) => {
      const state = await loadCheckMaintenanceByServiceId(ctx, extensions, id);
      return state ? ([id, state] as const) : null;
    }),
  );
  return Object.fromEntries(
    entries.filter((entry): entry is [string, CheckMaintenanceState] => !!entry),
  );
}
