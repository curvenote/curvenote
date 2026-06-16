'use client';

import { createContext, use, useMemo } from 'react';
import {
  DEFAULT_CHECK_MAINTENANCE_MESSAGE,
  type CheckMaintenanceState,
} from '../modules/extensions/check-maintenance.js';

export type CheckMaintenanceByServiceId = Record<string, CheckMaintenanceState>;

const CheckMaintenanceContext = createContext<CheckMaintenanceByServiceId | undefined>(undefined);

export function CheckMaintenanceProvider({
  maintenanceByServiceId,
  children,
}: {
  maintenanceByServiceId: CheckMaintenanceByServiceId;
  children: React.ReactNode;
}) {
  const value = useMemo(() => maintenanceByServiceId, [maintenanceByServiceId]);
  return <CheckMaintenanceContext value={value}>{children}</CheckMaintenanceContext>;
}

export function useCheckMaintenance(checkServiceId: string): CheckMaintenanceState | undefined {
  const context = use(CheckMaintenanceContext);
  return context?.[checkServiceId];
}

export function useCheckMaintenanceBlocked(checkServiceId: string): {
  blocked: boolean;
  message: string;
} {
  const state = useCheckMaintenance(checkServiceId);
  return {
    blocked: state?.underMaintenance === true,
    message: state?.message ?? DEFAULT_CHECK_MAINTENANCE_MESSAGE,
  };
}

export function useAnyCheckMaintenanceBlocked(checkServiceIds: string[]): {
  blocked: boolean;
  message: string;
} {
  const context = use(CheckMaintenanceContext);
  for (const id of checkServiceIds) {
    const state = context?.[id];
    if (state?.underMaintenance) {
      return { blocked: true, message: state.message };
    }
  }
  return { blocked: false, message: DEFAULT_CHECK_MAINTENANCE_MESSAGE };
}
