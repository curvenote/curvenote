import { ui } from '@curvenote/scms-core';
import type { UserDTO } from './db.server';
import { useCallback, useState } from 'react';
import { useFetcher } from 'react-router';

interface UserApproveRejectControlsProps {
  user: UserDTO;
}

export function UserApproveRejectControls({ user }: UserApproveRejectControlsProps) {
  const fetcher = useFetcher();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | undefined>(undefined);

  const handleConfirmAction = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log('handleConfirmAction', action);
      if (!action) {
        return;
      }

      const formData = new FormData();
      formData.append('intent', `${action}-user`);
      formData.append('userId', user.id);
      fetcher.submit(formData, { method: 'post' });

      setShowConfirmDialog(false);
      setAction(undefined);
    },
    [action, user.id],
  );

  const handleApprove = () => {
    setAction('approve');
    setShowConfirmDialog(true);
  };
  const handleReject = useCallback(() => {
    setAction('reject');
    setShowConfirmDialog(true);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <ui.StatefulButton
          size="xs"
          onClick={handleApprove}
          disabled={fetcher.state !== 'idle'}
          busy={fetcher.state !== 'idle' && action === 'approve'}
          overlayBusy
        >
          Approve
        </ui.StatefulButton>
        <ui.StatefulButton
          variant="destructive"
          size="xs"
          onClick={handleReject}
          disabled={fetcher.state !== 'idle'}
          busy={fetcher.state !== 'idle' && action === 'reject'}
          overlayBusy
        >
          Reject
        </ui.StatefulButton>
      </div>

      <ui.Dialog open={!!showConfirmDialog} onOpenChange={(open) => setShowConfirmDialog(open)}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>{action === 'approve' ? 'Approve' : 'Reject'} User</ui.DialogTitle>
            <ui.DialogDescription>
              Are you sure you want to {action === 'approve' ? 'Approve' : 'Reject'} the user "
              {user.display_name || user.email || 'Unknown User'}"?
              {action === 'approve' && (
                <span className="block mt-2 font-medium text-amber-600">
                  Warning: Approving this user will give them access to the application. The user
                  will be notified.
                </span>
              )}
              {action === 'reject' && (
                <span className="block mt-2 font-medium text-amber-600">
                  Warning: Rejecting this user will prevent them from accessing the application. The
                  user will not be notified.
                </span>
              )}
            </ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </ui.Button>
            <fetcher.Form method="post" onSubmit={handleConfirmAction}>
              <ui.StatefulButton
                type="submit"
                overlayBusy
                busy={fetcher.state !== 'idle'}
                variant={action === 'approve' ? 'default' : 'destructive'}
              >
                {action === 'approve' ? 'Approve' : 'Reject'} User
              </ui.StatefulButton>
            </fetcher.Form>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    </div>
  );
}
