import { Check, Minus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@curvenote/scms-core';

function NotCompleted() {
  return (
    <div className="w-7 h-7 bg-transparent rounded-full border-2 border-dashed border-stone-200" />
  );
}

function Completed() {
  return (
    <div className="flex justify-center items-center w-7 h-7 bg-green-50 rounded-full border border-green-500">
      <Check className="w-4 h-4 stroke-3 stroke-green-700" />
    </div>
  );
}

function Skipped() {
  return (
    <div className="flex justify-center items-center w-7 h-7 bg-orange-50 rounded-full">
      <Minus className="w-5 h-5 stroke-orange-500" />
    </div>
  );
}

export function TaskListStep({
  skipped,
  completed,
  disabled,
  title,
  children,
  open,
  setOpen,
}: React.PropsWithChildren<{
  title: React.ReactNode;
  skipped?: boolean;
  completed?: boolean;
  disabled?: boolean;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;

  return (
    <div className={'flex flex-col justify-center items-start'}>
      <div
        onClick={() => (setOpen ? setOpen(!open) : setInternalOpen(!internalOpen))}
        className={cn('px-8 py-6 w-full', {
          'cursor-not-allowed': disabled,
          'cursor-pointer': !disabled,
        })}
      >
        <div className="flex gap-2 items-center">
          {completed ? <Completed /> : skipped ? <Skipped /> : <NotCompleted />}
          <div
            className={cn('text-lg font-light', { 'opacity-50': completed || skipped || disabled })}
          >
            {title}
          </div>
        </div>
      </div>
      <div
        className={cn(
          'overflow-hidden w-full transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-8 pb-6 w-full">{children}</div>
      </div>
    </div>
  );
}
