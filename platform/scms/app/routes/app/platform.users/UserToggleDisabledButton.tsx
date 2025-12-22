import { useFetcher } from 'react-router';
import { useState } from 'react';
import { ui } from '@curvenote/scms-core';
import { UserCheck, UserX } from 'lucide-react';
import type { UserDTO } from './db.server';

interface UserToggleDisabledButtonProps {
  user: UserDTO;
}

export function UserToggleDisabledButton({ user }: UserToggleDisabledButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fetcher = useFetcher();

  const isDisabled = user.disabled;
  const actionText = isDisabled ? 'Enable' : 'Disable';
  const confirmText = isDisabled ? 'enable' : 'disable';
  const isLoading = fetcher.state === 'submitting';

  const handleToggle = () => {
    fetcher.submit(
      {
        intent: 'toggle-disabled',
        userId: user.id,
        disabled: !isDisabled,
      },
      { method: 'post' },
    );
    setShowConfirmDialog(false);
  };

  return (
    <>
      <ui.Button
        variant="outline"
        size="xs"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isLoading}
        className="text-xs"
      >
        {isDisabled ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
        {isLoading ? 'Processing...' : actionText}
      </ui.Button>

      <ui.Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>{actionText} User</ui.DialogTitle>
            <ui.DialogDescription>
              Are you sure you want to {confirmText} the user "
              {user.display_name || user.email || 'Unknown User'}"?
              {!isDisabled && (
                <span className="block mt-2 font-medium text-amber-600">
                  Warning: Disabling this user will prevent them from accessing any authenticated
                  routes or endpoints.
                </span>
              )}
              {user.ready_for_approval && (
                <span className="block mt-2 font-medium text-amber-600">
                  Warning: This user's original approval request was rejected. Enabling this user
                  will insert them back into the approval queue. The user will not be notified.
                </span>
              )}
            </ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </ui.Button>
            <ui.Button variant={isDisabled ? 'default' : 'destructive'} onClick={handleToggle}>
              {actionText} User
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    </>
  );
}
