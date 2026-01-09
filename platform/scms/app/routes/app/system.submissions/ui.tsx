import React from 'react';
import { useFetcher } from 'react-router';
import { X } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { SiteDTO } from '@curvenote/common';
import { WorkRole } from '@prisma/client';

interface WorkInfoProps {
  work: {
    id: string;
    doi: string | null;
    work_users?: Array<{
      id: string;
      user: {
        id: string;
        display_name: string | null;
        email: string | null;
      };
      role: WorkRole;
    }>;
  };
  users: Array<{
    id: string;
    display_name: string | null;
    email: string | null;
  }>;
}

export function WorkInfo({ work, users }: WorkInfoProps): JSX.Element {
  const fetcher = useFetcher<{
    work_users?: Array<{
      id: string;
      user: { id: string; display_name: string | null; email: string | null };
      role: WorkRole;
    }>;
    error?: string;
  }>();
  const workUsers = fetcher.data?.work_users || work.work_users;

  const handleDeleteUser = (workUserId: string, userName: string | null) => {
    if (!confirm(`Are you sure you want to remove ${userName || 'this user'} from this work?`)) {
      return;
    }

    const formData = new FormData();
    formData.append('formAction', 'remove-work-user');
    formData.append('workUserId', workUserId);
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <div className="pt-2">
      <div className="text-sm font-medium">Work</div>
      <div className="text-xs text-gray-500">ID: {work.id}</div>
      <div className="space-y-1 text-sm">
        <div>DOI: {work.doi}</div>
        {fetcher.data?.error && (
          <div className="p-2 text-sm text-red-600 rounded bg-red-50 dark:bg-red-900/20 dark:text-red-400">
            {fetcher.data.error}
          </div>
        )}
        {workUsers && workUsers.length > 0 && (
          <div>
            <div className="font-medium">Users:</div>
            <ul className="list-disc list-inside">
              {workUsers.map((workUser) => {
                const isOwner = workUser.role === WorkRole.OWNER;
                const isOnlyOwner =
                  isOwner && workUsers.filter((wu) => wu.role === WorkRole.OWNER).length === 1;
                const userName = workUser.user.display_name || workUser.user.email;

                return (
                  <li key={workUser.id} className="flex items-center gap-2 text-sm group">
                    <span>{userName}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                      {workUser.role}
                    </span>
                    {!isOnlyOwner && (
                      <button
                        onClick={() => handleDeleteUser(workUser.id, userName)}
                        className="p-1 transition-colors rounded cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700"
                        title="Remove user"
                      >
                        <X className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <fetcher.Form method="post" className="mt-2">
          <input type="hidden" name="formAction" value="add-work-user" />
          <input type="hidden" name="workId" value={work.id} />
          <div className="flex gap-2">
            <select
              name="userId"
              className="flex-1 px-2 py-1 text-xs border rounded dark:bg-stone-800 dark:border-stone-700"
              required
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name || user.email}
                </option>
              ))}
            </select>
            <select
              name="role"
              className="px-2 py-1 text-xs border rounded dark:bg-stone-800 dark:border-stone-700"
              required
            >
              <option value="">Role</option>
              {Object.values(WorkRole).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <ui.Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={fetcher.state !== 'idle'}
            >
              Add
            </ui.Button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

export function SiteSelect({
  sites,
  disabled,
  onChange,
}: {
  sites: SiteDTO[];
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="w-full max-w-md">
      <select
        className="w-full px-3 py-2 text-sm transition-colors duration-200 border border-blue-100 rounded-lg text-stone-600 placeholder:font-light focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-blue-100/20 dark:bg-transparent dark:text-white"
        name="site_name"
        disabled={disabled}
        onChange={onChange}
      >
        <option value="">Select a site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.name}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}
