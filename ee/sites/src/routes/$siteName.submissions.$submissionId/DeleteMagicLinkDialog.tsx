import { useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { ui } from '@curvenote/scms-core';

interface DeleteMagicLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: string;
  linkLabel?: string;
  onDeleted: () => void;
}

export function DeleteMagicLinkDialog({
  isOpen,
  onClose,
  linkId,
  linkLabel,
  onDeleted,
}: DeleteMagicLinkDialogProps) {
  const fetcher = useFetcher<{
    success?: boolean;
    error?: string;
  }>();
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);

  const handleDelete = () => {
    setHasHandledSuccess(false);
    const formData = new FormData();
    formData.append('formAction', 'magic-link-delete');
    formData.append('linkId', linkId);

    fetcher.submit(formData, { method: 'POST' });
  };

  // Handle successful deletion
  useEffect(() => {
    if (!hasHandledSuccess && fetcher.data?.success && fetcher.state === 'idle') {
      setHasHandledSuccess(true);
      onDeleted();
      onClose();
    }
  }, [fetcher.data, fetcher.state, hasHandledSuccess, onDeleted, onClose]);

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
          <ui.DialogTitle>Delete Access Link</ui.DialogTitle>
          <ui.DialogDescription>
            Are you sure you want to permanently delete this access link
            {linkLabel && (
              <>
                {' '}
                <strong>"{linkLabel}"</strong>
              </>
            )}
            ? This action cannot be undone and will remove all associated access logs.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button variant="outline" disabled={isSubmitting}>
              Cancel
            </ui.Button>
          </ui.DialogClose>
          <ui.Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
            {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
