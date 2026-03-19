import { useFetcher } from 'react-router';
import { ui, type GeneralError } from '@curvenote/scms-core';
import { useRef, useState, useCallback, useEffect } from 'react';

export function SiteRolesForm({ canGrantAdminRole }: { canGrantAdminRole: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<{ error?: GeneralError; message?: string; info?: string }>();
  const [selectedUser, setSelectedUser] = useState<string>('');

  // Handle toast notifications
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        const errorMessage =
          typeof fetcher.data.error === 'object' && 'message' in fetcher.data.error
            ? fetcher.data.error.message
            : 'An error occurred';
        ui.toastError(errorMessage);
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
        // Reset form on success
        setSelectedUser('');
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) {
      ui.toastError('Please select a user');
      return;
    }

    // Get form data directly from the form element
    // This automatically captures all form fields with 'name' attributes
    // e.g. role
    const formData = new FormData(e.currentTarget);
    // Add the intent and userId since they're not in the form
    formData.set('intent', 'grant');
    formData.set('userId', selectedUser);

    fetcher.submit(formData, { method: 'POST' });
  };

  return (
    <form ref={form} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex gap-2 items-center">
        <h3 className="font-medium text-md">Add a New User or Grant a Role</h3>
      </div>

      {/* Single row layout on md+ breakpoints */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Search User
          </label>
          <ui.AsyncComboBox
            boxed
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
            className="px-3 py-2 w-full text-sm bg-white rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            id="invite.role"
            name="role"
            required
            disabled={fetcher.state === 'submitting'}
          >
            {canGrantAdminRole && <option value="ADMIN">Admin</option>}
            <option value="EDITOR">Editor</option>
            <option value="SUBMITTER">Submitter</option>
          </select>
        </div>

        <div className="flex-none pb-[1px]">
          <ui.StatefulButton
            type="submit"
            overlayBusy
            busy={fetcher.state === 'submitting'}
            disabled={fetcher.state === 'submitting' || !selectedUser}
          >
            Grant
          </ui.StatefulButton>
        </div>
      </div>
    </form>
  );
}
