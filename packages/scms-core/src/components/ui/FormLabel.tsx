import * as React from 'react';
import { CheckIcon } from 'lucide-react';

export type FormLabelProps = {
  htmlFor: string;
  valid?: boolean;
  required?: boolean;
  defined?: boolean;
  children: React.ReactNode;
};

export function FormLabel({
  htmlFor,
  valid = false,
  required = false,
  defined = false,
  children,
}: FormLabelProps) {
  const showError = !valid && (required || defined);
  return (
    <label htmlFor={htmlFor} className="flex gap-2 items-center text-sm font-medium">
      <span>{children}</span>
      {valid ? (
        <CheckIcon className="w-4 h-4 text-green-500 shrink-0" aria-label="Valid" />
      ) : showError ? (
        <span className="text-destructive">*</span>
      ) : (
        <span className="text-muted-foreground">(optional)</span>
      )}
    </label>
  );
}
