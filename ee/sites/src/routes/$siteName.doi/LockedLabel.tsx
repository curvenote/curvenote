import { Lock } from 'lucide-react';

/** A field nobody can edit here: the lock says so next to the label. */
export function LockedLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium">
      {children}
      <Lock className="w-3 h-3 text-muted-foreground" aria-label="Read-only" />
    </label>
  );
}
