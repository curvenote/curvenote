import React from 'react';
import { useLocation } from 'react-router';
import { StatefulButton } from './ui/StatefulButton.js';
import { cn } from '../utils/cn.js';
import { useDeploymentConfig } from '../providers/DeploymentProvider.js';

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
}: FrameHeaderProps) {
  const location = useLocation();
  const deploymentConfig = useDeploymentConfig();

  // Look up current path in pages config
  const pageConfig = deploymentConfig.pages?.find((page) => page.path === location.pathname);

  // Use page config if found, otherwise use props
  // Page config takes precedence if both are provided
  const title = pageConfig?.title ?? propTitle;
  const subtitle = pageConfig?.subtitle ?? propSubtitle;
  const description = pageConfig?.description ?? propDescription;
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
      <div className="flex flex-row gap-4 justify-between items-center">
        {iconWithProps && <div className="flex flex-shrink-0 items-center">{iconWithProps}</div>}
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-normal tracking-tight">{title}</h1>
          {subtitle && <div className="py-1 text-base">{subtitle}</div>}
        </div>
        {actionLabel && (
          <div>
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
