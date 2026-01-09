import { useFetcher } from 'react-router';
import { UserIcon } from '@heroicons/react/24/outline';
import { X, Crown, Edit, Eye, User, FileText } from 'lucide-react';
import { Badge } from './ui/index.js';
import { cn } from '../utils/cn.js';
import { useEffect } from 'react';
import { useMyUser } from '../providers/MyUserProvider.js';
import { toastSuccess, toastError } from './ui/toast.js';

type UserProps = {
  roles: string[];
  email?: string | null;
  name?: string | null;
  userId?: string | null;
};

function TableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('border-b bg-background last:border-b-0', className)}>{children}</div>;
}

export function UserCard({ roles, email, name, userId }: UserProps) {
  const fetcher = useFetcher<{ ok: boolean; error?: string; info?: string }>();
  const currentUser = useMyUser();

  // Check if the current user is viewing their own card
  const isCurrentUser = currentUser && userId && currentUser.id === userId;

  // Handle toast notifications for role removal
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        toastError(fetcher.data.error);
      } else if (fetcher.data.info) {
        toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'OWNER':
        return <Crown className="w-4 h-4 text-foreground" />;
      case 'CONTRIBUTOR':
      case 'EDITOR':
        return <Edit className="w-4 h-4 text-foreground" />;
      case 'VIEWER':
      case 'REVIEWER':
        return <Eye className="w-4 h-4 text-foreground" />;
      case 'AUTHOR':
        return <User className="w-4 h-4 text-foreground" />;
      case 'SUBMITTER':
        return <FileText className="w-4 h-4 text-foreground" />;
      default:
        return <User className="w-4 h-4 text-foreground" />;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Admin';
      case 'EDITOR':
        return 'Editor';
      case 'REVIEWER':
        return 'Reviewer';
      case 'AUTHOR':
        return 'Author';
      case 'SUBMITTER':
        return 'Submitter';
      case 'OWNER':
        return 'Owner';
      case 'CONTRIBUTOR':
        return 'Contributor';
      case 'VIEWER':
        return 'Viewer';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }
  };

  return (
    <>
      <TableRow className="flex items-center justify-between p-4 bg-white">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-foreground/10">
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
          {roles.map((role) => (
            <div key={role} className="relative">
              {!isCurrentUser ? (
                <fetcher.Form
                  method="post"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      window.confirm(
                        `Are you sure you want to remove the ${getRoleDisplayName(role)} role from ${name || 'this user'}?`,
                      )
                    ) {
                      const formData = new FormData(e.currentTarget);
                      fetcher.submit(formData, { method: 'POST' });
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="email" value={email || ''} />
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
                    {getRoleIcon(role)}
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {getRoleDisplayName(role)}
                    </span>
                    <X className="w-3 h-3 ml-1 text-gray-400 transition-colors group-hover:text-red-500" />
                  </Badge>
                </fetcher.Form>
              ) : (
                <Badge variant="outline">
                  {getRoleIcon(role)}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {getRoleDisplayName(role)}
                  </span>
                </Badge>
              )}
            </div>
          ))}
        </div>
      </TableRow>
    </>
  );
}
