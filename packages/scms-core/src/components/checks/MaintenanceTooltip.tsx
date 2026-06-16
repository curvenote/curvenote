'use client';

import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip.js';

type MaintenanceTooltipProps = {
  enabled: boolean;
  message: string;
  children: ReactElement;
};

export function MaintenanceTooltip({ enabled, message, children }: MaintenanceTooltipProps) {
  if (!enabled) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={4}>{message}</TooltipContent>
    </Tooltip>
  );
}
