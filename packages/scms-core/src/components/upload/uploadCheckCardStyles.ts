import { cn } from '../../utils/cn.js';

/** Upload checks section: two columns at all breakpoints (section is wide; avoids md: SSR flash). */
export const UPLOAD_CHECKS_GRID_CLASS = 'grid grid-cols-2 gap-4';

/** Selected / unselected card chrome aligned with wizard option cards. */
export function uploadCheckCardClassName({
  enabled,
  disabled,
  busy,
}: {
  enabled: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return cn(
    'p-0 transition-all duration-100 border bg-white dark:bg-stone-900',
    'border-stone-200 dark:border-stone-500',
    !disabled && !busy && 'hover:border-stone-400 dark:hover:border-stone-400',
    enabled &&
      'cursor-pointer border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-800 hover:border-green-400 dark:hover:border-green-600',
    disabled && 'cursor-not-allowed opacity-60',
    busy && 'opacity-70 pointer-events-none',
  );
}
