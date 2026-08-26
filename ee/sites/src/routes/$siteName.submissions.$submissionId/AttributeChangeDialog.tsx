import { useState } from 'react';
import { ui } from '@curvenote/scms-core';
import type { AttributeChangeOption } from './AttributeChangeDialog.utils.js';

type AttributeChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  calloutType: 'warning' | 'info';
  calloutMessage: string;
  options: AttributeChangeOption[];
  currentId: string;
  confirmLabel: string;
  isSubmitting: boolean;
  error?: string;
  onConfirm: (selectedId: string, label: string) => void;
};

type AttributeChangeDialogBodyProps = Omit<AttributeChangeDialogProps, 'open' | 'onOpenChange'>;

function AttributeChangeDialogBody({
  title,
  calloutType,
  calloutMessage,
  options,
  currentId,
  confirmLabel,
  isSubmitting,
  error,
  onConfirm,
}: AttributeChangeDialogBodyProps) {
  const [selectedId, setSelectedId] = useState(currentId);
  const hasChange = selectedId !== currentId;
  const submittingLabel = confirmLabel.replace(/^Change /, 'Changing ');

  const handleConfirm = () => {
    const selectedOption = options.find((option) => option.id === selectedId);
    if (!hasChange || !selectedOption) {
      return;
    }
    onConfirm(selectedId, selectedOption.label);
  };

  return (
    <>
      <ui.DialogHeader>
        <ui.DialogTitle>{title}</ui.DialogTitle>
        {calloutType === 'info' && <ui.DialogDescription>{calloutMessage}</ui.DialogDescription>}
      </ui.DialogHeader>
      <div className="space-y-4">
        {calloutType === 'warning' && (
          <ui.SimpleAlert type="warning" message={calloutMessage} size="compact" />
        )}
        {error ? <ui.SimpleAlert type="error" message={error} size="compact" /> : null}
        <ui.RadioGroup
          value={selectedId}
          onValueChange={setSelectedId}
          className="grid gap-2"
          disabled={isSubmitting}
        >
          {options.map((option) => {
            const optionId = `attribute-change-${option.id}`;
            return (
              <div key={option.id} className="flex items-start gap-2">
                <ui.RadioGroupItem
                  value={option.id}
                  id={optionId}
                  className="mt-0.5"
                  disabled={isSubmitting}
                />
                <label htmlFor={optionId} className="min-w-0 cursor-pointer text-sm leading-snug">
                  {option.label}
                </label>
              </div>
            );
          })}
        </ui.RadioGroup>
      </div>
      <ui.DialogFooter>
        <ui.DialogClose asChild>
          <ui.Button variant="outline" disabled={isSubmitting}>
            Cancel
          </ui.Button>
        </ui.DialogClose>
        <ui.Button onClick={handleConfirm} disabled={!hasChange || isSubmitting}>
          {isSubmitting ? submittingLabel : confirmLabel}
        </ui.Button>
      </ui.DialogFooter>
    </>
  );
}

export function AttributeChangeDialog({
  open,
  onOpenChange,
  ...bodyProps
}: AttributeChangeDialogProps) {
  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent>{open && <AttributeChangeDialogBody {...bodyProps} />}</ui.DialogContent>
    </ui.Dialog>
  );
}
