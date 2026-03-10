import { Check } from 'lucide-react';
import { cn } from '@curvenote/scms-core';

export type InlineSaveState = 'idle' | 'saving' | 'saved';

export interface InlineSaveIndicatorProps {
  saveState: InlineSaveState;
  /** Optional class for the positioned wrapper (e.g. "absolute bottom-1 right-[6px]") */
  className?: string;
}

/**
 * Small indicator for inline save state: shows "Saving..." or a check icon.
 * Renders nothing when saveState is 'idle'. Use beside inputs that use useInlineSave.
 */
export function InlineSaveIndicator({ saveState, className }: InlineSaveIndicatorProps) {
  if (saveState === 'idle') return null;
  return (
    <div className={cn('pointer-events-none', className)}>
      {saveState === 'saving' && (
        <div className="text-xs text-muted-foreground">Saving...</div>
      )}
      {saveState === 'saved' && <Check className="w-4 h-4 text-green-600" />}
    </div>
  );
}
