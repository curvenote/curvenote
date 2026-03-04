import { Link, useNavigate, useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { Upload, Plus } from 'lucide-react';
import { useEffect } from 'react';

type WorkUser = {
  id: string;
  display_name: string | null;
  email: string | null;
  work_roles: string[];
};

/** Minimal shape for latest version used for resume-draft vs upload-new. */
export type WorkDetailsUploadProps = {
  canUpload: boolean;
  workBasePath: string;
  /** Latest work version (versions[0]); used to decide resume vs create and for resume target. */
  latestVersion: { id: string; draft?: boolean; metadata?: unknown } | null | undefined;
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

/** True when the latest version is a draft with checks metadata (resumable). */
export function canResumeDraft(
  canUpload: boolean,
  latestVersion: WorkDetailsUploadProps['latestVersion'],
): boolean {
  return (
    canUpload === true &&
    latestVersion?.draft === true &&
    latestVersion.metadata != null &&
    typeof latestVersion.metadata === 'object' &&
    'checks' in latestVersion.metadata
  );
}

export function WorkDetailsTopBar({
  workId,
  users,
  uploadProps,
}: {
  workId: string;
  users: WorkUser[];
  /** When provided, the top bar owns the upload button and resume vs create-new-version logic. */
  uploadProps: WorkDetailsUploadProps;
}) {
  const { canUpload, workBasePath, latestVersion } = uploadProps;
  const navigate = useNavigate();
  const fetcher = useFetcher<{
    intent?: string;
    success?: boolean;
    workId?: string;
    workVersionId?: string;
  }>();

  const resumeDraft = canResumeDraft(canUpload, latestVersion);
  const uploadButtonLabel = resumeDraft ? 'Resume Draft Version' : 'Upload New Version';

  const handleUploadAction = () => {
    if (!canUpload) return;
    if (resumeDraft && latestVersion) {
      navigate(`${workBasePath}/upload/${latestVersion.id}`);
      return;
    }
    const formData = new FormData();
    formData.append('intent', 'create-new-version');
    fetcher.submit(formData, { method: 'post', action: workBasePath });
  };

  useEffect(() => {
    if (
      fetcher.data &&
      'intent' in fetcher.data &&
      fetcher.data.intent === 'create-new-version' &&
      fetcher.state === 'idle'
    ) {
      if (
        'success' in fetcher.data &&
        fetcher.data.success &&
        fetcher.data.workId &&
        fetcher.data.workVersionId
      ) {
        navigate(`${workBasePath}/upload/${fetcher.data.workVersionId}`);
      }
    }
  }, [fetcher.state, fetcher.data, navigate, workBasePath]);

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
        <span className="text-sm font-medium text-muted-foreground">Invite</span>
      </Link>
      <div>
        {canUpload ? (
          <ui.Button
            type="button"
            size="default"
            variant="default"
            onClick={handleUploadAction}
            disabled={fetcher.state !== 'idle'}
            className="inline-flex gap-2 items-center text-base"
          >
            <Upload className="w-4 h-4" />
            {uploadButtonLabel}
          </ui.Button>
        ) : null}
      </div>
    </div>
  );
}
