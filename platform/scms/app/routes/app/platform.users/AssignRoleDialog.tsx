import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { GeneralError } from '@curvenote/scms-core';

interface Role {
  id: string;
  name: string;
  title: string;
  description: string;
  scopes: any;
}

interface AssignRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  availableRoles: Role[];
  userCurrentRoleIds: string[];
}

export function AssignRoleDialog({
  isOpen,
  onClose,
  userId,
  userName,
  availableRoles,
  userCurrentRoleIds,
}: AssignRoleDialogProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>();

  const isSubmitting = fetcher.state === 'submitting';

  // Filter out roles the user already has
  const availableRolesForUser = availableRoles.filter(
    (role) => !userCurrentRoleIds.includes(role.id),
  );

  const selectedRole = availableRoles.find((role) => role.id === selectedRoleId);

  // Handle assignment success/error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      ui.toastSuccess('Role assigned successfully');
      setSelectedRoleId('');
      onClose();
    } else if (fetcher.state === 'idle' && fetcher.data?.error) {
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
  }, [fetcher.state, fetcher.data]);

  const handleAssign = () => {
    if (!selectedRoleId || isSubmitting) return;

    const formData = new FormData();
    formData.append('intent', 'assign-role');
    formData.append('userId', userId);
    formData.append('roleId', selectedRoleId);

    fetcher.submit(formData, { method: 'POST' });
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedRoleId('');
      onClose();
    }
  };

  return (
    <ui.Dialog open={isOpen} onOpenChange={handleClose}>
      <ui.DialogContent className="w-full max-w-md">
        <ui.DialogHeader>
          <ui.DialogTitle>Assign Role to {userName}</ui.DialogTitle>
          <ui.DialogDescription>
            Select a role to assign to this user. Only roles not already assigned are shown.
          </ui.DialogDescription>
        </ui.DialogHeader>

        <div className="space-y-4">
          {availableRolesForUser.length > 0 ? (
            <>
              <div>
                <label className="text-sm font-medium">Select Role</label>
                <ui.Select
                  value={selectedRoleId}
                  onValueChange={setSelectedRoleId}
                  disabled={isSubmitting}
                >
                  <ui.SelectTrigger className="w-full h-16 mt-1">
                    <ui.SelectValue placeholder="Choose a role...">
                      {selectedRole && <span className="font-medium">{selectedRole.title}</span>}
                    </ui.SelectValue>
                  </ui.SelectTrigger>
                  <ui.SelectContent className="w-full max-h-96">
                    {availableRolesForUser.map((role) => (
                      <ui.SelectItem key={role.id} value={role.id} className="h-16">
                        <div className="flex flex-col py-2">
                          <span className="font-medium">{role.title}</span>
                          <span className="text-sm text-muted-foreground">{role.description}</span>
                        </div>
                      </ui.SelectItem>
                    ))}
                  </ui.SelectContent>
                </ui.Select>
              </div>
            </>
          ) : (
            <div className="py-4 text-center text-muted-foreground">
              No additional roles available to assign.
            </div>
          )}
        </div>

        <ui.DialogFooter>
          <ui.Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </ui.Button>
          <ui.Button onClick={handleAssign} disabled={!selectedRoleId || isSubmitting}>
            {isSubmitting ? 'Assigning...' : 'Assign Role'}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
