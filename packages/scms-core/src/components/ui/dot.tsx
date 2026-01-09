import { cn } from '../../utils/index.js';

export function Dot({ className }: { className?: string }) {
  return <div className={cn('inline-block w-2 h-2 bg-green-600 rounded-full', className)} />;
}
