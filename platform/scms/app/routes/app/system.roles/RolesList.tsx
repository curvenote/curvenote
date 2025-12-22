import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { RoleListItem } from './RoleListItem';
import { RoleListEditForm } from './RoleListEditForm';
import { DeleteRoleDialog } from './components/DeleteRoleDialog';
import type { GeneralError } from '@curvenote/scms-core';
import type { RoleWithCreator as Role } from '@curvenote/scms-server';

interface RolesListProps {
  roles: Role[];
}

// Wrapper component to handle individual role item state and actions
function RoleItemWrapper({ role }: { role: Role }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editData, setEditData] = useState({
    title: role.title,
    description: role.description,
    scopes: role.scopes.join(', '),
  });

  const updateFetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>();

  const deleteFetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>();

  const isUpdating = updateFetcher.state === 'submitting';
  const isDeleting = deleteFetcher.state === 'submitting';

  // Handle update success/error
  useEffect(() => {
    if (updateFetcher.state === 'idle' && updateFetcher.data?.success) {
      ui.toastSuccess('Role updated successfully');
      setIsEditing(false);
    } else if (updateFetcher.state === 'idle' && updateFetcher.data?.error) {
      let errorMessage: string;
      if (typeof updateFetcher.data.error === 'string') {
        errorMessage = updateFetcher.data.error;
      } else if (
        updateFetcher.data.error &&
        typeof updateFetcher.data.error === 'object' &&
        'message' in updateFetcher.data.error
      ) {
        errorMessage = updateFetcher.data.error.message;
      } else {
        errorMessage = 'An unknown error occurred';
      }
      ui.toastError(errorMessage);
    }
  }, [updateFetcher.state, updateFetcher.data]);

  // Handle delete success - dialog will handle the UI feedback
  useEffect(() => {
    if (deleteFetcher.state === 'idle' && deleteFetcher.data?.success) {
      // Dialog will handle the success message and closing
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  const handleEdit = () => {
    setEditData({
      title: role.title,
      description: role.description,
      scopes: role.scopes.join(', '),
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      title: role.title,
      description: role.description,
      scopes: role.scopes.join(', '),
    });
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append('intent', 'update');
    formData.append('id', role.id);
    formData.append('title', editData.title);
    formData.append('description', editData.description);
    formData.append('scopes', editData.scopes);

    updateFetcher.submit(formData, { method: 'POST' });
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  // const handleDeleteConfirmed = () => {
  //   const formData = new FormData();
  //   formData.append('intent', 'delete');
  //   formData.append('id', role.id);

  //   deleteFetcher.submit(formData, { method: 'POST' });
  // };

  if (isEditing) {
    return (
      <RoleListEditForm
        role={role}
        editData={editData}
        onDataChange={setEditData}
        onSave={handleSave}
        onCancel={handleCancel}
        isUpdating={isUpdating}
      />
    );
  }

  return (
    <>
      <RoleListItem
        role={role}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
      />
      <DeleteRoleDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        role={role}
        onDeleted={() => {
          // The dialog will handle closing itself
        }}
      />
    </>
  );
}

// Define filter options for roles
const roleFilters: ui.FilterDefinition[] = [
  {
    key: 'has-scopes',
    value: true,
    label: 'Has Scopes',
  },
  {
    key: 'recent',
    value: true,
    label: 'Recently Created',
  },
];

// Custom search component for roles
function RoleSearchComponent(searchTerm: string, setSearchTerm: (searchTerm: string) => void) {
  return (
    <ui.ClientQuerySearch
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      placeholder="Search roles by name, title, description, scopes, or creator..."
      resultLabel="role"
    />
  );
}

// Custom filtering function for roles
function filterRoles(
  roles: Role[],
  searchTerm: string,
  activeFilters: Record<string, any>,
): Role[] {
  let filtered = roles;

  // Apply search filter
  if (searchTerm.trim()) {
    const query = searchTerm.toLowerCase();
    filtered = filtered.filter((role) => {
      // Search in name, title, description
      const nameMatch = role.name.toLowerCase().includes(query);
      const titleMatch = role.title.toLowerCase().includes(query);
      const descriptionMatch = role.description.toLowerCase().includes(query);

      // Search in scopes
      const scopesMatch = role.scopes.some((scope) => scope.toLowerCase().includes(query));

      // Search in creator name
      const creatorName =
        role.creator.display_name || role.creator.username || role.creator.email || '';
      const creatorMatch = creatorName.toLowerCase().includes(query);

      return nameMatch || titleMatch || descriptionMatch || scopesMatch || creatorMatch;
    });
  }

  // Apply custom filters
  if (activeFilters['has-scopes']) {
    filtered = filtered.filter((role) => role.scopes.length > 0);
  }

  if (activeFilters['recent']) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    filtered = filtered.filter((role) => new Date(role.date_created) > oneWeekAgo);
  }

  return filtered;
}

export function RolesList({ roles }: RolesListProps) {
  return (
    <ui.ClientFilterableList
      items={roles}
      searchComponent={RoleSearchComponent}
      filterItems={filterRoles}
      renderItem={(role) => <RoleItemWrapper key={role.id} role={role} />}
      getItemKey={(role) => role.id}
      filters={roleFilters}
      emptyMessage="No roles have been created yet. Create your first role using the form above."
      className="space-y-4"
    />
  );
}
