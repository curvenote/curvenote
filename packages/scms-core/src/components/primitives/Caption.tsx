import { cn } from '../../utils/index.js';

export function Caption({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('text-xs text-stone-700 dark:text-stone-200', className)}>{children}</p>;
}
