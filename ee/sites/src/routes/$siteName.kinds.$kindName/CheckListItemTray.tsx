import { cn } from '@curvenote/scms-core';
import type { ReactNode } from 'react';

export function CheckListItemTray({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-end text-lg',
        'overflow-hidden duration-200',
        open && 'shadow-[inset_0_6px_12px_-8px_rgba(0,0,0,0.10)]',
        open
          ? 'animate-in fade-in slide-in-from-top-2'
          : 'animate-out fade-out slide-out-to-top-2 pointer-events-none h-0 min-h-0',
      )}
      style={{ transitionDuration: '200ms' }}
      aria-hidden={!open}
    >
      {open && children}
    </div>
  );
}
