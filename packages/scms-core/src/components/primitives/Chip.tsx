import { cn } from '../../utils/index.js';

export function Chip({
  children,
  className = 'text-stone-800 dark:text-white dark:bg-stone-500 bg-stone-200',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        className,
        'inline-flex items-center px-2 py-[2px] text-xs font-light rounded-full cursor-default',
      )}
      title={title}
    >
      {children}
    </span>
  );
}
