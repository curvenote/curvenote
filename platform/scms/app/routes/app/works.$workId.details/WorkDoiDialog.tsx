import { useState, useEffect, useCallback } from 'react';
import { useFetcher, useLocation } from 'react-router';
import { Check, X } from 'lucide-react';
import { RequestHelpDialog, ui, type GeneralError } from '@curvenote/scms-core';
import { parseDoiFormat } from './doiFormat.js';

type DoiActionResponse = {
  success?: boolean;
  intent?: string;
  doi?: string | null;
  error?: GeneralError | string;
};

type WorkDoiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workDoi: string | null | undefined;
};

function ValidationRow({
  label,
  state,
  error,
}: {
  label: string;
  state: 'idle' | 'valid' | 'invalid';
  error?: string;
}) {
  if (state === 'idle') return null;

  const isValid = state === 'valid';

  return (
    <div className="flex gap-2 items-start text-sm">
      {isValid ? (
        <Check className="mt-0.5 w-4 h-4 shrink-0 text-green-600" aria-hidden />
      ) : (
        <X className="mt-0.5 w-4 h-4 shrink-0 text-destructive" aria-hidden />
      )}
      <span className={isValid ? 'text-green-700 dark:text-green-500' : 'text-destructive'}>
        {label}
        {!isValid && error ? `: ${error}` : null}
      </span>
    </div>
  );
}

export function WorkDoiDialog({ open, onOpenChange, workDoi }: WorkDoiDialogProps) {
  const actionFetcher = useFetcher<DoiActionResponse>({ key: 'work-doi-dialog-action' });
  const location = useLocation();
  const [doiInput, setDoiInput] = useState('');
  const [pendingAction, setPendingAction] = useState<'set-doi' | 'clear-doi' | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const submitBusy = pendingAction != null;
  const [supportOpen, setSupportOpen] = useState(false);

  const resetFormState = useCallback(() => {
    setDoiInput(workDoi?.trim() ?? '');
    setPendingAction(null);
    setIsClosing(false);
  }, [workDoi]);

  useEffect(() => {
    if (!open) {
      resetFormState();
      return;
    }
    if (isClosing) return;
    setDoiInput(workDoi?.trim() ?? '');
  }, [open, workDoi, isClosing, resetFormState]);

  useEffect(() => {
    if (actionFetcher.state !== 'idle' || !actionFetcher.data) return;

    if (actionFetcher.data.error) {
      const message =
        typeof actionFetcher.data.error === 'string'
          ? actionFetcher.data.error
          : actionFetcher.data.error.message;
      ui.toastError(message);
      setPendingAction(null);
      setIsClosing(false);
      return;
    }

    if (actionFetcher.data.success) {
      setIsClosing(true);
      onOpenChange(false);
    }
  }, [actionFetcher.state, actionFetcher.data, onOpenChange]);

  const trimmedInput = doiInput.trim();
  const formatResult = trimmedInput ? parseDoiFormat(trimmedInput) : null;
  const formatValid = formatResult?.ok === true;
  const formatInvalid = trimmedInput.length > 0 && formatResult?.ok === false;

  const formatValidationState = !trimmedInput
    ? 'idle'
    : formatValid
      ? 'valid'
      : formatInvalid
        ? 'invalid'
        : 'idle';

  const handleSave = () => {
    if (!formatValid) return;
    setPendingAction('set-doi');
    const formData = new FormData();
    formData.append('intent', 'set-doi');
    formData.append('doi', trimmedInput);
    actionFetcher.submit(formData, { method: 'post' });
  };

  const handleClear = () => {
    setPendingAction('clear-doi');
    setIsClosing(true);
    onOpenChange(false);
    const formData = new FormData();
    formData.append('intent', 'clear-doi');
    actionFetcher.submit(formData, { method: 'post' });
  };

  const hasWorkDoi = workDoi != null && workDoi.trim() !== '';
  const currentPage = `${location.pathname}${location.search}${location.hash}`;
  const dialogBusy = submitBusy;

  return (
    <>
      <ui.SimpleDialog
        open={open}
        onOpenChange={(next) => {
          if (!dialogBusy) onOpenChange(next);
        }}
        title="DOI"
        description="Enter an existing DOI for this work. You can paste a DOI prefix/suffix or a full doi.org URL."
        footer={
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {hasWorkDoi && !isClosing ? (
                <ui.StatefulButton
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  busy={submitBusy && pendingAction === 'clear-doi'}
                  overlayBusy
                >
                  Clear DOI
                </ui.StatefulButton>
              ) : null}
              <ui.Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={dialogBusy}
              >
                Cancel
              </ui.Button>
              <ui.StatefulButton
                type="button"
                onClick={handleSave}
                disabled={!formatValid}
                busy={submitBusy && pendingAction === 'set-doi'}
                overlayBusy
              >
                Save
              </ui.StatefulButton>
            </div>
            <p className="text-xs text-muted-foreground">
              Looking to create a new DOI for your work?{' '}
              <ui.Button
                type="button"
                variant="link"
                className="inline h-auto p-0 text-xs"
                onClick={() => setSupportOpen(true)}
                disabled={dialogBusy}
              >
                contact support
              </ui.Button>{' '}
              for early access.
            </p>
          </div>
        }
      >
        <div>
          <ui.Label htmlFor="work-doi-input" className="text-sm font-medium">
            DOI
          </ui.Label>
          <ui.Input
            id="work-doi-input"
            value={doiInput}
            onChange={(e) => setDoiInput(e.target.value)}
            placeholder="10.1234/example or https://doi.org/10.1234/example"
            className="mt-2 font-mono"
            disabled={dialogBusy}
            aria-invalid={formatInvalid ? true : undefined}
          />
          <div className="mt-3 space-y-1">
            <ValidationRow
              label="Valid DOI format"
              state={formatValidationState}
              error={formatResult && !formatResult.ok ? formatResult.error : undefined}
            />
          </div>
        </div>
      </ui.SimpleDialog>

      <RequestHelpDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        actionUrl="/app/request-help"
        title="Request help from the support team"
        description="Sending this request will include your name and email address so we can respond to you."
        prompt="I'm interested in early access to create a new DOI for my work."
        currentPage={currentPage}
      />
    </>
  );
}
