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

  // A disabled button does not emit pointer events, so the tooltip would never
  // open if the trigger were the (disabled) child itself. Wrap it in a span that
  // always receives pointer events and acts as the trigger.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block">{children}</span>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>{message}</TooltipContent>
    </Tooltip>
  );
}
