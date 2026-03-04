import * as React from 'react';

type FormAreaProps = {
  stepNumber: number | string;
  stepTitle: string;
  children: React.ReactNode;
};

export function FormArea({ stepNumber, stepTitle, children }: FormAreaProps) {
  return (
    <div className="w-full max-w-2xl not-prose">
      <div className="flex gap-3 items-center p-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3E7AA9] text-white font-semibold shrink-0">
          {stepNumber}
        </div>
        <h3 className="text-lg font-semibold">{stepTitle}</h3>
      </div>
      <div className="p-6 space-y-6 border border-border bg-background">{children}</div>
    </div>
  );
}
