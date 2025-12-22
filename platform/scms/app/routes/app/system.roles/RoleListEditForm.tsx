import { Save, X } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

interface RoleListEditFormProps {
  role: {
    id: string;
    name: string;
    title: string;
    description: string;
    scopes: string[];
  };
  editData: {
    title: string;
    description: string;
    scopes: string;
  };
  onDataChange: (data: { title: string; description: string; scopes: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}

export function RoleListEditForm({
  role,
  editData,
  onDataChange,
  onSave,
  onCancel,
  isUpdating,
}: RoleListEditFormProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Edit Role</h3>
        <div className="flex gap-2">
          <ui.Button variant="outline" size="sm" onClick={onCancel} disabled={isUpdating}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </ui.Button>
          <ui.StatefulButton
            size="sm"
            onClick={onSave}
            overlayBusy
            busy={isUpdating}
            disabled={isUpdating}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </ui.StatefulButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <ui.Label htmlFor={`edit-name-${role.id}`}>Name</ui.Label>
          <ui.Input
            id={`edit-name-${role.id}`}
            value={role.name}
            disabled
            className="mt-1 bg-gray-100 dark:bg-gray-800"
          />
          <p className="mt-1 text-sm text-muted-foreground">Name cannot be changed</p>
        </div>

        <div>
          <ui.Label htmlFor={`edit-title-${role.id}`}>Title</ui.Label>
          <ui.Input
            id={`edit-title-${role.id}`}
            value={editData.title}
            onChange={(e) => onDataChange({ ...editData, title: e.target.value })}
            disabled={isUpdating}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <ui.Label htmlFor={`edit-description-${role.id}`}>Description</ui.Label>
        <ui.Textarea
          id={`edit-description-${role.id}`}
          value={editData.description}
          onChange={(e) => onDataChange({ ...editData, description: e.target.value })}
          disabled={isUpdating}
          className="mt-1"
          rows={3}
        />
      </div>

      <div>
        <ui.Label htmlFor={`edit-scopes-${role.id}`}>Scopes *</ui.Label>
        <ui.Textarea
          id={`edit-scopes-${role.id}`}
          value={editData.scopes}
          onChange={(e) => onDataChange({ ...editData, scopes: e.target.value })}
          disabled={isUpdating}
          className="mt-1"
          placeholder="app:compliance:read, app:platform:admin"
          rows={3}
          required
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Comma-separated list of scopes (e.g., app:compliance:read, platform:admin)
        </p>
      </div>
    </div>
  );
}
