import { CheckIcon } from 'lucide-react';

type FormLabelProps = {
  htmlFor: string;
  required?: boolean;
  /** True when field has valid content (optional: has value; required: filled; and within limits). */
  valid: boolean;
  /** True when field has a validation error (e.g. over limit). Shows red * even for optional. */
  invalid?: boolean;
  children: React.ReactNode;
};

export function FormLabel({ htmlFor, required, valid, invalid = false, children }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className="flex gap-2 items-center text-sm font-medium">
      <span>{children}</span>
      {valid ? (
        <CheckIcon className="w-4 h-4 text-green-500 shrink-0" aria-label="Valid" />
      ) : invalid ? (
        <span className="text-destructive">*</span>
      ) : required ? (
        <span className="text-destructive">*</span>
      ) : (
        <span className="text-muted-foreground">(optional)</span>
      )}
    </label>
  );
}
