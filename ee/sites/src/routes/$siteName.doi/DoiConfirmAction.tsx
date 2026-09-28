import { useState } from 'react';
import type { FetcherWithComponents } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { DoiActionData } from './doi.utils.js';

export type DoiConfirmActionProps = {
  intent: 'unlink-role' | 'reset';
  occ: number;
  title: string;
  description: string;
  confirmTitle: string;
  confirmDescription: string;
  buttonLabel: string;
  confirmVariant: 'default' | 'destructive';
  fetcher: FetcherWithComponents<DoiActionData>;
};

/**
 * One confirm-guarded action row: a title, what it does, and a button behind a dialog. It shares
 * the card's fetcher, so whichever card holds it shows the error or the confirmation.
 */
export function DoiConfirmAction({
  intent,
  occ,
  title,
  description,
  confirmTitle,
  confirmDescription,
  buttonLabel,
  confirmVariant,
  fetcher,
}: DoiConfirmActionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = fetcher.state !== 'idle';
  const onConfirm = () => {
    setConfirmOpen(false);
    fetcher.submit({ intent, occ }, { method: 'POST' });
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex-1 min-w-64">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm font-light">{description}</p>
      </div>
      <ui.StatefulButton
        type="button"
        variant="outline"
        className="ml-auto shrink-0"
        onClick={() => setConfirmOpen(true)}
        busy={busy && fetcher.formData?.get('intent') === intent}
        disabled={busy}
        overlayBusy
      >
        {buttonLabel}
      </ui.StatefulButton>
      <ui.Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>{confirmTitle}</ui.DialogTitle>
            <ui.DialogDescription>{confirmDescription}</ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.DialogClose asChild>
              <ui.Button variant="ghost">Cancel</ui.Button>
            </ui.DialogClose>
            <ui.Button variant={confirmVariant} onClick={onConfirm}>
              {buttonLabel}
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    </div>
  );
}
