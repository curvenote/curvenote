import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../../utils/cn.js';
import { InfoIcon } from 'lucide-react';

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipArrow({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      className={cn(
        'bg-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]',
        props.className,
      )}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipArrow />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function SimpleTooltip({
  title,
  side,
  sideOffset,
  delayDuration = 100,
  children,
  asChild = true,
  className,
}: {
  title: string;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side'];
  sideOffset?: number;
  delayDuration?: number;
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset} className={className}>
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SimpleTooltipWithIcon({
  title,
  side,
  sideOffset,
  delayDuration = 100,
}: {
  title: string;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side'];
  sideOffset?: number;
  delayDuration?: number;
}) {
  <SimpleTooltip title={title} side={side} sideOffset={sideOffset} delayDuration={delayDuration}>
    <InfoIcon className="inline-block w-[1.25em] h-[1.25em] -translate-y-[1px] text-muted-foreground" />
  </SimpleTooltip>;
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipArrow,
  SimpleTooltip,
  SimpleTooltipWithIcon,
};
