import { formatDatetime, ui } from '@curvenote/scms-core';
import { LinkedAccountBadge } from './LinkedAccountBadge';
import { Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { UserDTO } from './db.server';
import { UserToggleDisabledButton } from './UserToggleDisabledButton';
import { UserApproveRejectControls } from './UserApproveRejectControls';
import { AssignRoleDialog } from './AssignRoleDialog';
import { RoleBadge } from './RoleBadge';

interface UserCardProps {
  user: UserDTO;
  availableRoles: any[];
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
        className="inline-flex items-center gap-1 font-mono text-xs transition-colors cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
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
      className="inline-flex items-center gap-1 text-sm text-gray-600 truncate transition-colors cursor-pointer dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      title={copied ? 'Copied!' : 'Copy email'}
    >
      <span className="truncate">{email}</span>
      <Copy className="flex-shrink-0 w-3 h-3" />
      {copied && <span className="flex-shrink-0">Copied</span>}
    </button>
  );
}

export function UserListItem({ user, availableRoles }: UserCardProps) {
  const [showAssignRoleDialog, setShowAssignRoleDialog] = useState(false);

  // Helper function to get display name
  const getDisplayName = () => {
    return user.display_name || '<not set>';
  };

  // Get current role IDs for filtering
  const userCurrentRoleIds = user.roles?.map((userRole) => userRole.role.id) || [];

  return (
    <div className="flex flex-col w-full gap-3 lg:flex-row lg:gap-6">
      {/* Main Info Section - takes full width on mobile, flex-grow on desktop */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-2">
          {/* Header row with name and status badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center min-w-0 gap-2">
              <h3 className="text-lg font-medium text-gray-900 truncate dark:text-gray-100">
                {getDisplayName()}
              </h3>
              {user.username && (
                <span className="text-sm text-gray-600 dark:text-gray-400">@{user.username}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {user.pending && !user.ready_for_approval && (
                <ui.Badge variant="warning">Pending</ui.Badge>
              )}
              {!user.disabled && user.pending && user.ready_for_approval && (
                <ui.Badge variant="warning">Awaiting Approval</ui.Badge>
              )}
              {user.disabled && user.ready_for_approval && (
                <ui.Badge variant="destructive">Approval Rejected</ui.Badge>
              )}
              {user.disabled && <ui.Badge variant="destructive">Disabled</ui.Badge>}
            </div>
          </div>

          {/* Contact info row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {user.email && <CopyableEmail email={user.email} />}
            <CopyableUserID userId={user.id} />
          </div>

          {/* Dates row */}
          <div className="text-xs text-gray-500 dark:text-gray-500">
            Created: {formatDatetime(user.date_created, 'MMM dd, yyyy')} • Modified:{' '}
            {formatDatetime(user.date_modified, 'MMM dd, yyyy')}
          </div>

          {/* Site Roles row */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
              Site Roles:
            </span>
            {user.site_roles.length > 0 ? (
              user.site_roles.map((siteRole) => (
                <ui.Badge key={siteRole.id} variant="outline" className="text-xs">
                  {siteRole.role}@{siteRole.site.name}
                </ui.Badge>
              ))
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-500">None</span>
            )}
          </div>

          {/* Additional Roles row */}
          <div className="flex flex-wrap items-center gap-1 mt-3">
            <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Roles:
            </span>
            {user.roles && user.roles.length > 0 ? (
              user.roles.map((userRole) => (
                <RoleBadge
                  key={userRole.id}
                  userRole={userRole}
                  userId={user.id}
                  onRemove={() => {
                    // The RoleBadge component handles the removal via fetcher
                    // We don't need to do anything here as the page will re-render
                  }}
                />
              ))
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-500">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Accounts & System Role Section - stacks on mobile, side-by-side on desktop */}
      <div className="flex flex-col gap-3 lg:flex-shrink-0 lg:w-42">
        {/* Primary Account */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
            Primary Account:
          </span>
          {user.primaryProvider ? (
            <ui.Badge variant="outline">{user.primaryProvider}</ui.Badge>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-500">unknown</span>
          )}
        </div>

        {/* Linked accounts - filter out primary provider to avoid duplication */}
        {(() => {
          // Filter out accounts that match the primary provider to avoid duplication
          const filteredLinkedAccounts = user.linkedAccounts.filter((account) => {
            // For Firebase-based logins, we need special handling
            if (user.primaryProvider === 'firebase') {
              // Firebase can have both 'firebase' and 'google' providers for the same user
              // We want to show 'google' in linked accounts even if primary is 'firebase'
              return account.provider !== 'firebase';
            }
            // For other providers, filter out the primary provider
            return account.provider !== user.primaryProvider;
          });

          if (filteredLinkedAccounts.length > 0) {
            return (
              <div className="flex flex-wrap items-center gap-1">
                <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Linked Accounts:
                </span>
                {filteredLinkedAccounts.map((account) => (
                  <LinkedAccountBadge key={`${user.id}-${account.id}`} account={account} />
                ))}
              </div>
            );
          } else {
            return (
              <div className="flex flex-wrap items-center gap-1">
                <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Linked Accounts:
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">None</span>
              </div>
            );
          }
        })()}

        {/* System role */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
            System Role:
          </span>
          {user.system_role !== 'USER' && <ui.Badge variant="outline">{user.system_role}</ui.Badge>}
          {user.system_role === 'USER' && (
            <span className="text-xs text-gray-500 dark:text-gray-500">User</span>
          )}
        </div>
      </div>

      {/* Actions Section */}
      <div className="flex flex-col items-start gap-2 lg:flex-shrink-0 lg:w-32">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Actions:</span>
        {!(user.ready_for_approval && !user.disabled) && <UserToggleDisabledButton user={user} />}
        {!user.disabled && user.pending && user.ready_for_approval && (
          <UserApproveRejectControls user={user} />
        )}
        {availableRoles.filter((role) => !userCurrentRoleIds.includes(role.id)).length > 0 && (
          <ui.Button
            variant="outline"
            size="xs"
            onClick={() => setShowAssignRoleDialog(true)}
            className="text-xs"
          >
            <UserPlus className="w-3 h-3 mr-1" />
            Assign Role
          </ui.Button>
        )}
      </div>

      {/* Assign Role Dialog */}
      <AssignRoleDialog
        isOpen={showAssignRoleDialog}
        onClose={() => setShowAssignRoleDialog(false)}
        userId={user.id}
        userName={getDisplayName()}
        availableRoles={availableRoles}
        userCurrentRoleIds={userCurrentRoleIds}
      />
    </div>
  );
}
