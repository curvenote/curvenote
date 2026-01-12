import { useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { ui } from '@curvenote/scms-core';
import type { GeneralError } from '@curvenote/scms-core';

interface DeleteRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  role: {
    id: string;
    name: string;
    title: string;
  };
  onDeleted: () => void;
}

export function DeleteRoleDialog({ isOpen, onClose, role, onDeleted }: DeleteRoleDialogProps) {
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>();
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);

  const handleDelete = () => {
    setHasHandledSuccess(false); // Reset success handling state
    const formData = new FormData();
    formData.append('intent', 'delete');
    formData.append('id', role.id);

    fetcher.submit(formData, { method: 'POST' });
  };

  // Handle successful deletion
  useEffect(() => {
    if (!hasHandledSuccess && fetcher.data?.success && fetcher.state === 'idle') {
      setHasHandledSuccess(true);
      ui.toastSuccess('Role deleted successfully');
      onDeleted();
      onClose();
    }
  }, [fetcher.data, fetcher.state, hasHandledSuccess, onDeleted, onClose]);

  // Handle deletion error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.error) {
      let errorMessage: string;
      if (typeof fetcher.data.error === 'string') {
        errorMessage = fetcher.data.error;
      } else if (
        fetcher.data.error &&
        typeof fetcher.data.error === 'object' &&
        'message' in fetcher.data.error
      ) {
        errorMessage = fetcher.data.error.message;
      } else {
        errorMessage = 'An unknown error occurred';
      }
      ui.toastError(errorMessage);
    }
  }, [fetcher.data, fetcher.state]);

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
          <ui.DialogTitle>Delete Role</ui.DialogTitle>
          <ui.DialogDescription>
            Are you sure you want to delete the role <strong>"{role.title}"</strong> ({role.name})?
            This action cannot be undone.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button variant="outline" disabled={isSubmitting}>
              Cancel
            </ui.Button>
          </ui.DialogClose>
          <ui.Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
            {isSubmitting ? 'Deleting...' : 'Delete Role'}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
