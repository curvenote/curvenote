import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { SquarePen } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';

type DetailFieldEditorShellProps = {
  children: ReactNode;
  value: ReactNode;
  valueClassName?: string;
};

export function DetailFieldEditorShell({
  children,
  value,
  valueClassName,
}: DetailFieldEditorShellProps) {
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <span className={cn('min-w-0 truncate text-sm text-muted-foreground', valueClassName)}>
        {value}
      </span>
      {children}
    </div>
  );
}

type DetailFieldEditorTriggerProps = Omit<
  ComponentPropsWithoutRef<typeof ui.Button>,
  'children' | 'value'
>;

export const DetailFieldEditorTrigger = forwardRef<
  HTMLButtonElement,
  DetailFieldEditorTriggerProps
>(function DetailFieldEditorTriggerButton({ title, className, ...props }, ref) {
  return (
    <ui.Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon-xs"
      title={title}
      aria-label={title ?? 'Edit'}
      {...props}
      className={cn('shrink-0 text-muted-foreground', className)}
    >
      <SquarePen aria-hidden />
    </ui.Button>
  );
});
