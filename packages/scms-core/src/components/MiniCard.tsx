import { cn } from '../utils/cn.js';
import type { ReactNode } from 'react';

export interface MiniCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  indicator?: ReactNode;
  actions?: ReactNode;
  className?: string;
  lift?: boolean;
  children?: ReactNode;
}

export function MiniCard({
  title,
  subtitle,
  indicator,
  actions,
  className,
  lift = false,
  children,
}: MiniCardProps) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-4 rounded-lg border p-4',
        'bg-stone-50 dark:bg-stone-800/50',
        {
          'shadow-[0px_1px_2px_0px_rgba(68,64,60,0.24),0px_1px_3px_0px_rgba(68,64,60,0.12)] border-stone-200 dark:border-stone-700':
            lift,
          'border-stone-200 dark:border-stone-700': !lift,
        },
        className,
      )}
    >
      {children || (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-medium truncate dark:text-stone-100">{title}</div>
              {indicator && <div>{indicator}</div>}
            </div>
            {subtitle && (
              <div className="text-sm truncate text-stone-600 dark:text-stone-400">{subtitle}</div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </>
      )}
    </div>
  );
}
