import { useEffect } from 'react';
import { useFetcher, useFetchers, Link, useParams, useLocation } from 'react-router';
import {
  ui,
  hasInvalidEnabledUploadChecks,
  useAnyCheckMaintenanceBlocked,
} from '@curvenote/scms-core';
import type { ExtensionCheckService, FileMetadataSection } from '@curvenote/scms-core';
import type { WorkVersionMetadata, ChecksMetadataSection } from '@curvenote/scms-server';

interface ContinueFormProps {
  title: string;
  authors: string;
  metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
  checkServices: ExtensionCheckService[];
}

export function ContinueForm({ title, authors, metadata, checkServices }: ContinueFormProps) {
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
  const hasInvalidSelectedChecks = hasInvalidEnabledUploadChecks(
    metadata,
    enabledChecks,
    checkServices,
  );
  const { blocked: maintenanceBlocked } = useAnyCheckMaintenanceBlocked(enabledChecks);

  const hasPendingToggleCheck = fetchers.some(
    (f) => f.state !== 'idle' && f.formData?.get('intent') === 'toggle-check',
  );

  // A selected check whose service is under maintenance does not block submission;
  // it is simply skipped (not initiated) and the work is created without it.
  const disabled =
    !hasTitle || !hasFiles || hasPendingToggleCheck || hasInvalidSelectedChecks;

  const handleContinue = () => {
    const formData = new FormData();
    formData.append('intent', 'confirm-work');
    if (authors?.trim()) {
      formData.append('authors', authors);
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
