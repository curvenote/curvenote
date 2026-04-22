import { useState } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { RefreshCw } from 'lucide-react';
import type { UserDTO } from './db.server';

interface UserSystemRoleToggleProps {
  user: UserDTO;
}

/**
 * Toggle a user's system role between USER and ANON.
 *
 * Only renders when the user's current system_role is USER or ANON —
 * ADMIN/SERVICE users are not toggleable here. The server enforces the
 * same invariant regardless of what the UI submits.
 */
export function UserSystemRoleToggle({ user }: UserSystemRoleToggleProps) {
  const fetcher = useFetcher();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (user.system_role !== 'USER' && user.system_role !== 'ANON') {
    return null;
  }

  const currentRole = user.system_role;
  const nextRole = currentRole === 'USER' ? 'ANON' : 'USER';
  const isSubmitting = fetcher.state !== 'idle';

  const handleConfirm = () => {
    const formData = new FormData();
    formData.append('intent', 'change-system-role');
    formData.append('userId', user.id);
    formData.append('systemRole', nextRole);
    fetcher.submit(formData, { method: 'post' });
    setShowConfirmDialog(false);
  };

  return (
    <>
      <ui.Button
        variant="outline"
        size="xs"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isSubmitting}
        className="text-xs"
        title={`Change system role to ${nextRole}`}
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        {isSubmitting ? 'Updating...' : `Set ${nextRole}`}
      </ui.Button>

      <ui.Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>Change System Role</ui.DialogTitle>
            <ui.DialogDescription>
              Change the system role for "{user.display_name || user.email || 'Unknown User'}" from{' '}
              <span className="font-medium">{currentRole}</span> to{' '}
              <span className="font-medium">{nextRole}</span>?
              <span className="block mt-2 font-medium text-amber-600">
                Only USER &#x2194; ANON transitions are permitted here. Scopes derived from the
                system role will change immediately and may affect the user's access.
              </span>
            </ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </ui.Button>
            <ui.Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : `Set ${nextRole}`}
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    </>
  );
}
