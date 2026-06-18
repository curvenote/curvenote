import { useEffect } from 'react';
import { useFetcher, useFetchers, Link, useParams, useLocation } from 'react-router';
import {
  ui,
  hasInvalidEnabledUploadChecks,
  useAnyCheckMaintenanceBlocked,
  useChecksNotUnderMaintenance,
} from '@curvenote/scms-core';
import type { ExtensionCheckService, FileMetadataSection } from '@curvenote/scms-core';
import type { WorkVersionMetadata, ChecksMetadataSection } from '@curvenote/scms-server';
import type { AuthorFieldMetadata } from './mystAuthorAdapters';

interface ContinueFormProps {
  title: string;
  authorMetadata: AuthorFieldMetadata;
  metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
  checkServices: ExtensionCheckService[];
  /** Selected thumbnail locator (see thumbnailSelection.ts); materialised on submit. */
  selectedThumbnail?: string | null;
}

export function ContinueForm({
  title,
  authorMetadata,
  metadata,
  checkServices,
  selectedThumbnail,
}: ContinueFormProps) {
  const fetcher = useFetcher();
  const fetchers = useFetchers();
  const { workId } = useParams();
  const location = useLocation();
  const fromNewFlow = new URLSearchParams(location.search).get('from') === 'new';
  const finishLaterHref = fromNewFlow
    ? '/app/works'
    : workId
      ? `/app/works/${workId}/details`
      : '/app/works';

  // Show toast when action returns an error (e.g. confirm-work failed)
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) {
      ui.toastError((fetcher.data as { error: { message: string } }).error.message);
    }
  }, [fetcher.state, fetcher.data]);

  const hasTitle = Boolean(title?.trim());
  const hasFiles =
    metadata.files != null &&
    typeof metadata.files === 'object' &&
    Object.keys(metadata.files).length > 0;

  const enabledChecks = metadata.checks?.enabled ?? [];
  // Mirror the server's `confirm-work`: checks under maintenance are dropped
  // (not initiated), so only validate compatibility for the dispatchable ones.
  // A check that is both incompatible and under maintenance must not block
  // submission, since the server would drop it and accept the work.
  const dispatchableChecks = useChecksNotUnderMaintenance(enabledChecks);
  const hasInvalidSelectedChecks = hasInvalidEnabledUploadChecks(
    metadata,
    dispatchableChecks,
    checkServices,
  );
  const { blocked: maintenanceBlocked } = useAnyCheckMaintenanceBlocked(enabledChecks);

  const hasPendingToggleCheck = fetchers.some(
    (f) => f.state !== 'idle' && f.formData?.get('intent') === 'toggle-check',
  );
  const hasPendingAuthorMetadata = fetchers.some(
    (f) => f.state !== 'idle' && f.formData?.get('intent') === 'update-author-metadata',
  );

  // A selected check whose service is under maintenance does not block submission;
  // it is simply skipped (not initiated) and the work is created without it.
  const disabled =
    !hasTitle ||
    !hasFiles ||
    hasPendingToggleCheck ||
    hasPendingAuthorMetadata ||
    hasInvalidSelectedChecks;

  const handleContinue = () => {
    const formData = new FormData();
    formData.append('intent', 'confirm-work');
    formData.append('authorMetadata', JSON.stringify(authorMetadata));
    if (selectedThumbnail) {
      formData.append('thumbnail', selectedThumbnail);
    }
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <div className="mt-6 space-y-2">
      <div className="flex gap-4 items-center">
        <ui.StatefulButton
          type="button"
          busy={fetcher.state !== 'idle'}
          disabled={disabled}
          onClick={handleContinue}
        >
          Continue
        </ui.StatefulButton>
        <ui.Button variant="link" asChild>
          <Link to={finishLaterHref}>Come back and finish this later</Link>
        </ui.Button>
      </div>
      {maintenanceBlocked ? (
        <p className="text-sm text-muted-foreground">
          At least one service is temporarily down for maintenance. The affected check will be
          skipped and can be run later.
        </p>
      ) : null}
    </div>
  );
}
