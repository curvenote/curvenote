import { CheckIcon } from 'lucide-react';

type FormLabelProps = {
  htmlFor: string;
  required?: boolean;
  valid: boolean;
  children: React.ReactNode;
};

export function FormLabel({ htmlFor, required, valid, children }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className="flex gap-2 items-center text-sm font-medium">
      <span>{children}</span>
      {valid ? (
        <CheckIcon className="w-4 h-4 text-green-500 shrink-0" aria-label="Valid" />
      ) : required ? (
        <span className="text-destructive">*</span>
      ) : (
        <span className="text-muted-foreground">(optional)</span>
      )}
    </label>
  );
}
