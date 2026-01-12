import { cn } from '../../utils/index.js';

export interface StatusBarProps {
  children?: React.ReactNode;
  className?: string;
  hasSecondaryNav?: boolean;
}

export function StatusBar({ children, className, hasSecondaryNav }: StatusBarProps) {
  return (
    <div
      data-name="status-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-10',
        'h-7', // 24px height
        'bg-stone-50 dark:bg-stone-800',
        'border-t border-stone-200 dark:border-stone-700',
        'flex items-center justify-end',
        'text-xs text-stone-600 dark:text-stone-400',
        // Align with MainWrapper's content area
        'pl-2', // mobile left padding to match mx-2
        {
          // When hasSecondaryNav=true, align with PageFrame's left padding
          'xl:ml-[390px] xl:pl-3': hasSecondaryNav,
          // When hasSecondaryNav=false, align with MainWrapper's padding
          'xl:ml-[110px] xl:pl-3': !hasSecondaryNav,
        },
        // Consistent right padding of 2 across all screen sizes
        'pr-2 xl:pr-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
