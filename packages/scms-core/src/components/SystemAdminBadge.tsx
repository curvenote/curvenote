import { BoltIcon } from '@heroicons/react/24/outline';

/**
 * Used to decorate pages that are accessible because of the users System Admin role
 */
export function SystemAdminBadge() {
  return (
    <span className="inline-flex items-center mr-2 space-x-1">
      <BoltIcon className="w-4 h-4 stroke-gray-400 fill-yellow-400" />
      <p className="text-xs text-stone-700 dark:text-stone-200">SYSTEM ADMIN</p>
      <BoltIcon className="w-4 h-4 stroke-gray-400 fill-yellow-400" />
    </span>
  );
}
