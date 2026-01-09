import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { Badge } from './badge.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip.js';
import { X } from 'lucide-react';
import { toastSuccess, toastError } from './toast.js';
import type { GeneralError } from '../../backend/types.js';

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
  // const [, setShowConfirmDialog] = useState(false);
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>();

  // const isRemoving = fetcher.state === 'submitting';

  // Handle removal success/error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      toastSuccess('Role removed successfully');
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
      toastError(errorMessage);
    }
  }, [fetcher.state, fetcher.data]);

  // const handleRemove = () => {
  //   if (fetcher.state === 'submitting') return;

  //   const formData = new FormData();
  //   formData.append('intent', 'remove-role');
  //   formData.append('userId', userId);
  //   formData.append('userRoleId', userRole.id);

  //   fetcher.submit(formData, { method: 'POST' });
  //   setShowConfirmDialog(false);
  // };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center">
            <fetcher.Form
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  window.confirm(
                    `Are you sure you want to remove the ${userRole.role.title} role from this user?`,
                  )
                ) {
                  const formData = new FormData(e.currentTarget);
                  fetcher.submit(formData, { method: 'POST' });
                }
              }}
            >
              <input type="hidden" name="intent" value="remove-role" />
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="userRoleId" value={userRole.id} />
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
                  {userRole.role.title}
                </span>
                <X className="w-3 h-3 ml-1 text-gray-400 transition-colors group-hover:text-red-500" />
              </Badge>
            </fetcher.Form>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 [&>svg]:fill-white [&>svg]:dark:fill-gray-800"
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
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
