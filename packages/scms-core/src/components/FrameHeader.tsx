import React from 'react';
import { StatefulButton } from './ui/StatefulButton.js';
import { cn } from '../utils/cn.js';

interface FrameHeaderProps {
  className?: string;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionAlign?: 'inline' | 'right';
}

export function FrameHeader({
  className,
  icon,
  title: propTitle,
  subtitle: propSubtitle,
  description: propDescription,
  actionLabel,
  actionDisabled,
  actionIcon,
  onAction,
  actionAlign = 'inline',
}: FrameHeaderProps) {
  const title = propTitle;
  const subtitle = propSubtitle;
  const description = propDescription;
  // Apply default icon classes, allow override
  const iconWithProps =
    icon && React.isValidElement(icon)
      ? React.cloneElement(icon, {
          className: `${icon.props.className ?? ''} w-12 h-12 stroke-[1] text-foreground`.trim(),
          strokeWidth: 1.5,
          ...icon.props,
        })
      : icon;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-row gap-4 items-center">
        {iconWithProps && <div className="flex flex-shrink-0 items-center">{iconWithProps}</div>}
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-normal tracking-tight">{title}</h1>
          {subtitle && <div className="py-1 text-base">{subtitle}</div>}
        </div>
        {actionLabel && (
          <div className={cn(actionAlign === 'right' && 'ml-auto')}>
            <StatefulButton onClick={onAction} disabled={actionDisabled}>
              <div className="flex flex-row gap-2 items-center">
                {actionIcon && <div className="flex flex-shrink-0 items-center">{actionIcon}</div>}
                <div className="flex flex-shrink-0 items-center">{actionLabel}</div>
              </div>
            </StatefulButton>
          </div>
        )}
      </div>
      {description && (
        <div className="text-base leading-relaxed text-muted-foreground">{description}</div>
      )}
    </div>
  );
}
