import { useFetcher } from 'react-router';
import { UserIcon } from '@heroicons/react/24/outline';
import { X } from 'lucide-react';
import { Badge } from './ui/index.js';
import { SimpleDialog } from './ui/dialogs/index.js';
import { cn } from '../utils/cn.js';
import { useEffect, useState } from 'react';
import { useMyUser } from '../providers/MyUserProvider.js';
import { toastSuccess, toastError } from './ui/toast.js';
import type { GeneralError } from '../backend/types.js';

type UserProps = {
  roles: { role: string; canRemove: boolean }[];
  email?: string | null;
  name?: string | null;
  userId?: string | null;
  canUpdateUsers?: boolean;
};

function TableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('border-b bg-background last:border-b-0', className)}>{children}</div>;
}

export function UserCard({ roles, email, name, userId }: UserProps) {
  const fetcher = useFetcher<{ error?: GeneralError; message?: string; info?: string }>();
  const currentUser = useMyUser();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<string | null>(null);
  const [formToSubmit, setFormToSubmit] = useState<HTMLFormElement | null>(null);

  // Check if the current user is viewing their own card
  const isCurrentUser = currentUser && userId && currentUser.id === userId;

  // Handle toast notifications for role removal
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        const errorMessage =
          typeof fetcher.data.error === 'object' && 'message' in fetcher.data.error
            ? fetcher.data.error.message
            : 'An error occurred';
        toastError(errorMessage);
      } else if (fetcher.data.info) {
        toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const getRoleDisplayName = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  const handleConfirmRemove = () => {
    if (formToSubmit) {
      const formData = new FormData(formToSubmit);
      fetcher.submit(formData, { method: 'POST' });
    }
    setConfirmDialogOpen(false);
    setRoleToRemove(null);
    setFormToSubmit(null);
  };

  const handleCancelRemove = () => {
    setConfirmDialogOpen(false);
    setRoleToRemove(null);
    setFormToSubmit(null);
  };

  return (
    <>
      <TableRow className="flex justify-between items-center p-4 bg-white">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-foreground/10">
              <UserIcon className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-base font-medium truncate text-foreground">
                {name || 'Unknown User'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {roles.map(({ role, canRemove }) => (
            <div key={role} className="relative">
              {!isCurrentUser && canRemove ? (
                <fetcher.Form
                  method="post"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!userId) {
                      toastError('Cannot remove user: user ID is missing');
                      return;
                    }
                    setRoleToRemove(role);
                    setFormToSubmit(e.currentTarget);
                    setConfirmDialogOpen(true);
                  }}
                >
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="userId" value={userId || ''} />
                  <input type="hidden" name="role" value={role} />
                  <Badge
                    variant="outline"
                    className="pr-1 transition-colors cursor-pointer group hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950 dark:hover:border-red-800"
                    onClick={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget.closest('form');
                      if (form) {
                        const event = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(event);
                      }
                    }}
                  >
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {getRoleDisplayName(role)}
                    </span>
                    <X className="ml-1 w-3 h-3 text-gray-400 transition-colors group-hover:text-red-500" />
                  </Badge>
                </fetcher.Form>
              ) : (
                <Badge variant="outline">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {getRoleDisplayName(role)}
                  </span>
                </Badge>
              )}
            </div>
          ))}
        </div>
      </TableRow>
      <SimpleDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Remove Role"
        description={
          roleToRemove
            ? `Are you sure you want to remove the ${getRoleDisplayName(roleToRemove)} role from ${name || 'this user'}?`
            : ''
        }
        footerButtons={[
          {
            label: 'Cancel',
            onClick: handleCancelRemove,
            variant: 'outline',
          },
          {
            label: 'Remove Role',
            onClick: handleConfirmRemove,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
}
