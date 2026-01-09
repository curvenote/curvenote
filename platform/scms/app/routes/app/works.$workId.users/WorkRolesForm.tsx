import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { useRef, useState, useCallback, useEffect } from 'react';
import type { GeneralError } from '@curvenote/scms-core';

export function WorkRolesForm() {
  const form = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<{
    message?: string;
    error?: string | GeneralError;
    info?: string;
  }>();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('CONTRIBUTOR');

  // Handle toast notifications
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
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
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
        // Reset form on success
        setSelectedUser('');
        setSelectedRole('CONTRIBUTOR');
        form.current?.reset();
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Search function for AsyncComboBox using plain fetch
  const searchUsers = useCallback(async (query: string): Promise<ui.ComboBoxOption[]> => {
    if (query.length < 3) {
      return [];
    }

    try {
      const formData = new FormData();
      formData.append('query', query);

      const response = await fetch('/app/search/users', {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Search request failed:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();

      if (data.error) {
        console.error('User search failed:', data.error.message);
        return [];
      }

      if (data.searchResults && Array.isArray(data.searchResults)) {
        return data.searchResults.map((user: any) => ({
          value: user.id,
          label: user.display_name || 'Unknown User',
          description: user.email,
          metadata: {
            email: user.email,
            date_created: user.date_created,
          },
        }));
      }

      return [];
    } catch (error) {
      console.error('User search failed:', error);
      return [];
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      ui.toastError('Please select a user');
      return;
    }

    const formData = new FormData();
    formData.append('intent', 'grant');
    formData.append('userId', selectedUser);
    formData.append('role', selectedRole);

    fetcher.submit(formData, { method: 'POST' });
  };

  return (
    <form ref={form} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-md">Add New User</h3>
      </div>

      {/* Single row layout on md+ breakpoints */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Search User
          </label>
          <ui.AsyncComboBox
            value={selectedUser}
            onValueChange={setSelectedUser}
            onSearch={searchUsers}
            placeholder="Select a user..."
            searchPlaceholder="Search users by name or email..."
            emptyMessage="No users found. Try searching with at least 3 characters."
            loadingMessage="Searching users..."
            minSearchLength={3}
            disabled={fetcher.state === 'submitting'}
          />
        </div>

        <div className="flex-none md:min-w-[200px]">
          <label
            htmlFor="invite.role"
            className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Role
          </label>
          <select
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            id="invite.role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            required
            disabled={fetcher.state === 'submitting'}
          >
            <option value="OWNER">Owner</option>
            <option value="CONTRIBUTOR">Contributor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>

        <div className="flex-none">
          <ui.StatefulButton
            type="submit"
            overlayBusy
            busy={fetcher.state === 'submitting'}
            disabled={fetcher.state === 'submitting' || !selectedUser}
          >
            Add User
          </ui.StatefulButton>
        </div>
      </div>
    </form>
  );
}
