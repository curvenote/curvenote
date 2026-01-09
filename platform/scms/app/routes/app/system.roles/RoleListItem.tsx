import { Edit2, Trash2 } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

interface RoleListItemProps {
  role: {
    id: string;
    name: string;
    title: string;
    description: string;
    scopes: string[];
    date_created: string;
    creator: {
      id: string;
      username: string | null;
      display_name: string | null;
      email: string | null;
    };
  };
  onEdit: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function RoleListItem({
  role,
  onEdit,
  onDelete,
  isUpdating,
  isDeleting,
}: RoleListItemProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCreatorName = () => {
    return role.creator.display_name || role.creator.username || role.creator.email || 'Unknown';
  };

  return (
    <div className="flex items-start justify-between w-full">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold">{role.title}</h3>
          <span className="px-2 py-1 font-mono text-sm bg-gray-100 rounded text-muted-foreground dark:bg-gray-800">
            {role.name}
          </span>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Created by {getCreatorName()} • {formatDate(role.date_created)}
        </p>

        <p className="mb-3 text-sm">{role.description}</p>

        {role.scopes.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">Scopes:</p>
            <div className="flex flex-wrap gap-1">
              {role.scopes.map((scope, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded dark:bg-blue-900 dark:text-blue-200"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 ml-4">
        <ui.Button variant="outline" size="sm" onClick={onEdit} disabled={isUpdating || isDeleting}>
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </ui.Button>

        <ui.StatefulButton
          variant="outline"
          size="sm"
          onClick={onDelete}
          overlayBusy
          busy={isDeleting}
          disabled={isUpdating || isDeleting}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ui.StatefulButton>
      </div>
    </div>
  );
}
