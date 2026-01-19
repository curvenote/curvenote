import { ui, formatDatetime } from '@curvenote/scms-core';
import { Copy } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useFetcher } from 'react-router';
import type { $Enums } from '@curvenote/scms-db';
import type { SystemUserDTO } from './db.server';

interface SystemUserCardProps {
  user: SystemUserDTO;
  currentUserId: string;
}

function CopyableUserID({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="text-xs text-gray-500 dark:text-gray-500">
      <span>ID: </span>
      <button
        onClick={copyToClipboard}
        className="inline-flex gap-1 items-center font-mono text-xs transition-colors cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
        title={copied ? 'Copied!' : 'Copy user ID'}
      >
        <span>{userId}</span>
        <Copy className="w-3 h-3" />
        {copied && <span>Copied</span>}
      </button>
    </div>
  );
}

function CopyableEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className="inline-flex gap-1 items-center text-sm text-gray-600 truncate transition-colors cursor-pointer dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      title={copied ? 'Copied!' : 'Copy email'}
    >
      <span className="truncate">{email}</span>
      <Copy className="flex-shrink-0 w-3 h-3" />
      {copied && <span className="flex-shrink-0">Copied</span>}
    </button>
  );
}

// Type for action response
type ActionResponse = {
  success?: boolean;
  error?: string;
  user?: SystemUserDTO;
};

export function SystemUserListItem({ user, currentUserId }: SystemUserCardProps) {
  const fetcher = useFetcher<ActionResponse>();
  const [selectedRole, setSelectedRole] = useState<$Enums.SystemRole>(user.system_role);

  const isCurrentUser = user.id === currentUserId;
  const isLoading = fetcher.state !== 'idle';

  // Helper function to get display name
  const getDisplayName = useCallback(() => {
    return user.display_name || '<not set>';
  }, [user.display_name]);

  // Get role display name
  const getRoleDisplayName = useCallback((role: string) => {
    switch (role) {
      case 'USER':
        return 'User';
      case 'ADMIN':
        return 'Admin';
      case 'PLATFORM_ADMIN':
        return 'Platform Admin';
      case 'SERVICE':
        return 'Service';
      case 'ANON':
        return 'Anonymous';
      default:
        return role;
    }
  }, []);

  // Handle toast notifications for success/error
  useEffect(() => {
    if (fetcher.data?.success) {
      const userName = getDisplayName();
      const roleName = getRoleDisplayName(selectedRole);
      ui.toastSuccess(`${userName}'s role updated to ${roleName}`);
    }
    if (fetcher.data?.error) {
      ui.toastError(fetcher.data.error);
    }
  }, [fetcher.data, selectedRole, getDisplayName, getRoleDisplayName]);

  const handleRoleChange = (newRole: string) => {
    const roleValue = newRole as $Enums.SystemRole;
    setSelectedRole(roleValue);

    const formData = new FormData();
    formData.append('intent', 'updateSystemRole');
    formData.append('userId', user.id);
    formData.append('systemRole', newRole);

    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <div className="flex flex-col gap-1 items-start w-full md:gap-6 md:flex-row">
      {/* Column 1: Main user info (grows to fill space) */}
      <div data-name="card-column-1" className="flex-grow min-w-0">
        <div className="space-y-2">
          {/* Display name - large and prominent */}
          <h3 className="text-lg font-medium text-gray-900 truncate dark:text-gray-100">
            {getDisplayName()}
            {isCurrentUser && <span className="ml-2 text-sm text-blue-600">(You)</span>}
          </h3>

          {/* Username with @ prefix */}
          {user.username && (
            <p className="text-sm text-gray-600 dark:text-gray-400">@{user.username}</p>
          )}

          {/* Email */}
          {user.email && <CopyableEmail email={user.email} />}

          {/* User ID with copy functionality */}
          <CopyableUserID userId={user.id} />

          <div className="text-xs text-gray-500 dark:text-gray-500">
            Created: {formatDatetime(user.date_created, 'MMM dd, yyyy')} • Modified:{' '}
            {formatDatetime(user.date_modified, 'MMM dd, yyyy')}
          </div>
        </div>
      </div>

      {/* Column 2 - System role form only (fixed width) */}
      <div data-name="card-column-2" className="flex-shrink-0 w-72">
        <div className="space-y-4">
          {/* System role form */}
          <div className="p-3 bg-gray-50 rounded-md border dark:bg-gray-800">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              System Role
            </h4>

            {isCurrentUser ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <ui.Badge variant="outline">{getRoleDisplayName(user.system_role)}</ui.Badge>
                <p className="mt-1 text-xs text-gray-500">You cannot change your own role</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <ui.Select
                  value={selectedRole}
                  onValueChange={handleRoleChange}
                  disabled={isLoading}
                >
                  <ui.SelectTrigger className="w-full">
                    <ui.SelectValue placeholder="Select role" />
                  </ui.SelectTrigger>
                  <ui.SelectContent>
                    <ui.SelectItem value="USER">User</ui.SelectItem>
                    <ui.SelectItem value="PLATFORM_ADMIN">Platform Admin</ui.SelectItem>
                    <ui.SelectItem value="ADMIN">Admin</ui.SelectItem>
                    <ui.SelectItem value="SERVICE">Service</ui.SelectItem>
                  </ui.SelectContent>
                </ui.Select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
