import { cn, ui } from '@curvenote/scms-core';
import { getSlugConfirmCopy, type SlugConfirmAction } from './SlugManagerDialog.utils.js';

const DESTRUCTIVE_SOFT_BUTTON_CLASS = cn(
  'bg-destructive/10 text-red-800 shadow-xs hover:bg-destructive/15 hover:text-red-800 dark:bg-destructive/20 dark:text-red-300 dark:hover:bg-destructive/30 dark:hover:text-red-200',
);

type ConfirmSlugActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SlugConfirmAction;
  slug: string;
  isSubmitting: boolean;
  error?: string;
  onConfirm: () => void;
};

export function ConfirmSlugActionDialog({
  open,
  onOpenChange,
  action,
  slug,
  isSubmitting,
  error,
  onConfirm,
}: ConfirmSlugActionDialogProps) {
  const copy = getSlugConfirmCopy(action, slug);
  const isRemove = action === 'remove';

  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent>
        <ui.DialogHeader>
          <ui.DialogTitle>{copy.title}</ui.DialogTitle>
          <ui.DialogDescription>{copy.description}</ui.DialogDescription>
        </ui.DialogHeader>
        {error ? <ui.SimpleAlert type="error" message={error} size="compact" /> : null}
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button variant="outline" disabled={isSubmitting}>
              Cancel
            </ui.Button>
          </ui.DialogClose>
          <ui.Button
            variant={isRemove ? 'ghost' : 'default'}
            className={isRemove ? DESTRUCTIVE_SOFT_BUTTON_CLASS : undefined}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? copy.submittingLabel : copy.confirmLabel}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
