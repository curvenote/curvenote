import { useState, useEffect } from 'react';
import { useFetcher, useLocation } from 'react-router';
import { RequestHelpDialog, ui, type GeneralError } from '@curvenote/scms-core';

type DoiActionResponse = {
  success?: boolean;
  doi?: string | null;
  error?: GeneralError | string;
};

type WorkDoiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workDoi: string | null | undefined;
};

export function WorkDoiDialog({ open, onOpenChange, workDoi }: WorkDoiDialogProps) {
  const fetcher = useFetcher<DoiActionResponse>({ key: 'work-doi-dialog' });
  const location = useLocation();
  const [doiInput, setDoiInput] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDoiInput(workDoi?.trim() ?? '');
      setInlineError(null);
    }
  }, [open, workDoi]);

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;

    if (fetcher.data.error) {
      const message =
        typeof fetcher.data.error === 'string' ? fetcher.data.error : fetcher.data.error.message;
      setInlineError(message);
      ui.toastError(message);
      return;
    }

    if (fetcher.data.success) {
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onOpenChange]);

  const busy = fetcher.state === 'submitting';

  const handleSave = () => {
    setInlineError(null);
    const formData = new FormData();
    formData.append('intent', 'set-doi');
    formData.append('doi', doiInput);
    fetcher.submit(formData, { method: 'post' });
  };

  const handleClear = () => {
    setInlineError(null);
    const formData = new FormData();
    formData.append('intent', 'clear-doi');
    fetcher.submit(formData, { method: 'post' });
  };

  const hasWorkDoi = workDoi != null && workDoi.trim() !== '';
  const currentPage = `${location.pathname}${location.search}${location.hash}`;

  return (
    <>
      <ui.SimpleDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next);
        }}
        title="DOI"
        description="Enter an existing DOI for this work. You can paste a DOI prefix/suffix or a full doi.org URL."
        footer={
          <>
            {hasWorkDoi ? (
              <ui.Button variant="outline" onClick={handleClear} disabled={busy}>
                Clear DOI
              </ui.Button>
            ) : null}
            <ui.Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </ui.Button>
            <ui.Button onClick={handleSave} disabled={busy || !doiInput.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </ui.Button>
          </>
        }
      >
        <div className="space-y-4">
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
              disabled={busy}
              aria-invalid={inlineError ? true : undefined}
            />
            {inlineError ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {inlineError}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Looking to create a new DOI for your work?{' '}
            <ui.Button
              type="button"
              variant="link"
              className="inline h-auto p-0 text-xs"
              onClick={() => setSupportOpen(true)}
            >
              contact support
            </ui.Button>{' '}
            for early access.
          </p>
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
