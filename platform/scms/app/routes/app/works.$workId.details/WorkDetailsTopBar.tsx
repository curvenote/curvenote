import { Link } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { Upload, Plus } from 'lucide-react';

type WorkUser = {
  id: string;
  display_name: string | null;
  email: string | null;
  work_roles: string[];
};

function getInitials(displayName: string | null): string {
  if (!displayName || displayName.trim() === '') return '?';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return (first + last).toUpperCase().slice(0, 2);
  }
  return displayName.slice(0, 2).toUpperCase();
}

export function WorkDetailsTopBar({
  workId,
  users,
  uploadHref,
}: {
  workId: string;
  users: WorkUser[];
  uploadHref: string | null;
}) {
  const usersPageHref = `/app/works/${workId}/users`;

  return (
    <div className="flex flex-wrap gap-4 justify-between items-center w-full">
      <Link
        to={usersPageHref}
        prefetch="intent"
        className="flex gap-2 items-center no-underline rounded-md text-foreground hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Who can access this work"
      >
        <div className="flex items-center -space-x-2">
          {users.slice(0, 5).map((u) => (
            <span
              key={u.id}
              className="inline-flex justify-center items-center w-8 h-8 text-xs font-medium rounded-full border-2 shrink-0 border-background bg-muted text-muted-foreground"
              title={u.display_name ?? u.email ?? u.id}
            >
              {getInitials(u.display_name)}
            </span>
          ))}
        </div>
        <span className="flex justify-center items-center w-8 h-8 rounded-full border-2 border-dashed shrink-0 border-muted-foreground/40 text-muted-foreground">
          <Plus className="w-4 h-4" />
        </span>
        <span className="text-sm font-medium text-muted-foreground">Share</span>
      </Link>
      <div>
        {uploadHref ? (
          <ui.Button asChild size="default" variant="default">
            <Link to={uploadHref} prefetch="intent" className="inline-flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Upload new version
            </Link>
          </ui.Button>
        ) : null}
      </div>
    </div>
  );
}
