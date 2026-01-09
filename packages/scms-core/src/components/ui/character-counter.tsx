import { cn } from '../../utils/cn.js';

interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

/**
 * CharacterCounter: Displays current character count vs maximum
 * Turns red when limit is exceeded
 */
export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const isExceeded = current > max;

  return (
    <div
      className={cn(
        'text-xs text-muted-foreground text-right',
        isExceeded && 'text-red-600 dark:text-red-400',
        className,
      )}
    >
      {current} / {max} characters
    </div>
  );
}
