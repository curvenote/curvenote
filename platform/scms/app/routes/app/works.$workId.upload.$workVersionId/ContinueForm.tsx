import { useEffect } from 'react';
import { useFetcher, Link, useParams, useLocation } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { FileMetadataSection } from '@curvenote/scms-core';
import type { WorkVersionMetadata } from '@curvenote/scms-server';
import type { ChecksMetadataSection } from './checks.schema';

interface ContinueFormProps {
  title: string;
  authors: string;
  metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
}

export function ContinueForm({ title, authors, metadata }: ContinueFormProps) {
  const fetcher = useFetcher();
  const { workId } = useParams();
  const location = useLocation();
  const fromNewFlow = new URLSearchParams(location.search).get('from') === 'new';
  const finishLaterHref = fromNewFlow ? '/app/works' : (workId ? `/app/works/${workId}/details` : '/app/works');

  // Show toast when action returns an error (e.g. confirm-work failed)
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) {
      ui.toastError((fetcher.data as { error: { message: string } }).error.message);
    }
  }, [fetcher.state, fetcher.data]);

  // Check if title is non-empty
  const hasTitle = title && title.trim().length > 0;

  // Check if at least one file is uploaded
  const hasFiles = true; //'files' in metadata && metadata.files && Object.keys(metadata.files).length > 0;

  // Button is only enabled if both conditions are met
  const disabled = !hasTitle || !hasFiles;

  const handleContinue = () => {
    const formData = new FormData();
    formData.append('intent', 'confirm-work');
    if (authors?.trim()) {
      formData.append('authors', authors);
    }
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <div className="flex gap-4 items-center mt-6">
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
  );
}
