import { useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { ui } from '@curvenote/scms-core';

interface ConfirmMagicLinkActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: string;
  linkLabel?: string;
  action: 'revoke' | 'reactivate';
  onConfirmed: () => void;
}

export function ConfirmMagicLinkActionDialog({
  isOpen,
  onClose,
  linkId,
  linkLabel,
  action,
  onConfirmed,
}: ConfirmMagicLinkActionDialogProps) {
  const fetcher = useFetcher<{
    success?: boolean;
    error?: string;
  }>();
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);

  const isRevoke = action === 'revoke';

  const handleConfirm = () => {
    setHasHandledSuccess(false);
    const formData = new FormData();
    formData.append('formAction', isRevoke ? 'magic-link-revoke' : 'magic-link-reactivate');
    formData.append('linkId', linkId);

    fetcher.submit(formData, { method: 'POST' });
  };

  // Handle successful action
  useEffect(() => {
    if (!hasHandledSuccess && fetcher.data?.success && fetcher.state === 'idle') {
      setHasHandledSuccess(true);
      onConfirmed();
      onClose();
    }
  }, [fetcher.data, fetcher.state, hasHandledSuccess, onConfirmed, onClose]);

  // Reset success handling state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setHasHandledSuccess(false);
    }
  }, [isOpen]);

  const isSubmitting = fetcher.state !== 'idle';

  return (
    <ui.Dialog open={isOpen} onOpenChange={onClose}>
      <ui.DialogContent>
        <ui.DialogHeader>
          <ui.DialogTitle>
            {isRevoke ? 'Revoke Access Link' : 'Reactivate Access Link'}
          </ui.DialogTitle>
          <ui.DialogDescription>
            {isRevoke ? (
              <>
                Are you sure you want to revoke this access link
                {linkLabel && (
                  <>
                    {' '}
                    <strong>"{linkLabel}"</strong>
                  </>
                )}
                ? The link will no longer work and recipients will be unable to access the
                submission.
              </>
            ) : (
              <>
                Reactivate this access link
                {linkLabel && (
                  <>
                    {' '}
                    <strong>"{linkLabel}"</strong>
                  </>
                )}
                ? The link will become active again and recipients will be able to access the
                submission.
              </>
            )}
          </ui.DialogDescription>
        </ui.DialogHeader>
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button variant="outline" disabled={isSubmitting}>
              Cancel
            </ui.Button>
          </ui.DialogClose>
          <ui.Button
            variant={isRevoke ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isRevoke
                ? 'Revoking...'
                : 'Reactivating...'
              : isRevoke
                ? 'Revoke Link'
                : 'Reactivate Link'}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
