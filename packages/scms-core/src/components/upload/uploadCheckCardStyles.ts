import { cn } from '../../utils/cn.js';

/** Upload checks section: one column on narrow viewports, two from `sm` up. */
export const UPLOAD_CHECKS_GRID_CLASS = 'grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2';

/** Selected / unselected card chrome aligned with wizard option cards. */
export function uploadCheckCardClassName({
  enabled,
  disabled,
  invalid,
  warning,
  busy,
}: {
  enabled: boolean;
  disabled?: boolean;
  invalid?: boolean;
  warning?: boolean;
  busy?: boolean;
}) {
  return cn(
    'flex h-full flex-col p-0 transition-all duration-100 border bg-white dark:bg-stone-900',
    'border-stone-200 dark:border-stone-500',
    !disabled &&
      !busy &&
      !invalid &&
      !warning &&
      'hover:border-stone-400 dark:hover:border-stone-400',
    enabled &&
      !invalid &&
      !warning &&
      'cursor-pointer border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-800 hover:border-green-400 dark:hover:border-green-600',
    warning &&
      'cursor-pointer border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30 hover:border-amber-400 dark:hover:border-amber-600',
    enabled &&
      invalid &&
      'cursor-pointer border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/40 hover:border-red-400 dark:hover:border-red-600',
    disabled && 'cursor-not-allowed opacity-60',
    busy && 'opacity-70 pointer-events-none',
  );
}
