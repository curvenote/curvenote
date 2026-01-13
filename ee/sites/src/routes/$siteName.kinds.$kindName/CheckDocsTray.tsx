import { useState, useRef } from 'react';
import { GraduationCap } from 'lucide-react';

interface CheckDocsTrayProps {
  check: any;
}

export function CheckDocsTray({ check }: CheckDocsTrayProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!check?.docs) return null;

  return (
    <div className="w-full flex flex-col items-start gap-2">
      {/* Toggle row */}
      <button
        type="button"
        className="flex items-center gap-2 text-blue-700 underline text-sm font-medium py-1 px-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer"
        aria-label={
          open ? `Show less documentation for ${check.title}` : `Learn more about ${check.title}`
        }
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((o) => !o);
        }}
        style={{ marginLeft: 0 }}
      >
        <GraduationCap className="w-4 h-4" aria-hidden="true" />
        <span>{open ? 'Show less' : 'Learn more...'}</span>
      </button>
      {/* Animated docs tray */}
      <div
        className={`w-full overflow-hidden transition-all duration-100 bg-muted ${open ? 'max-h-[500px] opacity-100 overflow-auto p-6' : 'max-h-0 opacity-0 py-2'}`}
        style={{
          transitionProperty: 'max-height, opacity',
        }}
        ref={contentRef}
        aria-hidden={!open}
      >
        <div className="text-sm text-foreground" style={{ whiteSpace: 'pre-line' }}>
          {check.docs}
        </div>
      </div>
    </div>
  );
}
