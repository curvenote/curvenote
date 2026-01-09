import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { X } from 'lucide-react';
import type { GeneralError } from '@curvenote/scms-core';

interface RoleBadgeProps {
  userRole: {
    id: string;
    role: {
      id: string;
      name: string;
      title: string;
      description: string;
      scopes: any;
    };
  };
  userId: string;
  onRemove: () => void;
}

export function RoleBadge({ userRole, userId, onRemove }: RoleBadgeProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>();

  const isRemoving = fetcher.state === 'submitting';

  // Handle removal success/error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      ui.toastSuccess('Role removed successfully');
      onRemove();
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

  const handleRemove = () => {
    if (fetcher.state === 'submitting') return;

    const formData = new FormData();
    formData.append('intent', 'remove-role');
    formData.append('userId', userId);
    formData.append('userRoleId', userRole.id);

    fetcher.submit(formData, { method: 'POST' });
    setShowConfirmDialog(false);
  };

  return (
    <>
      <ui.Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <ui.PopoverTrigger asChild>
          <div className="inline-flex items-center">
            <ui.Badge
              variant="outline"
              className="pr-1 transition-colors cursor-pointer group hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950 dark:hover:border-red-800"
              onClick={() => setShowConfirmDialog(true)}
              onMouseEnter={() => setIsPopoverOpen(true)}
              onMouseLeave={() => setIsPopoverOpen(false)}
            >
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {userRole.role.title}
              </span>
              <X className="w-3 h-3 ml-1 text-gray-400 transition-colors group-hover:text-red-500" />
            </ui.Badge>
          </div>
        </ui.PopoverTrigger>
        <ui.PopoverContent
          side="top"
          className="max-w-xs bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700"
          onMouseEnter={() => setIsPopoverOpen(true)}
          onMouseLeave={() => setIsPopoverOpen(false)}
        >
          <div className="space-y-2">
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {userRole.role.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {userRole.role.description}
              </div>
            </div>
          </div>
        </ui.PopoverContent>
      </ui.Popover>

      <ui.Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <ui.DialogContent className="max-w-md">
          <ui.DialogHeader>
            <ui.DialogTitle>Remove Role</ui.DialogTitle>
            <ui.DialogDescription>
              Are you sure you want to remove the <strong>{userRole.role.title}</strong> role from
              this user?
            </ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isRemoving}
            >
              Cancel
            </ui.Button>
            <ui.Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving ? 'Removing...' : 'Remove Role'}
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    </>
  );
}
