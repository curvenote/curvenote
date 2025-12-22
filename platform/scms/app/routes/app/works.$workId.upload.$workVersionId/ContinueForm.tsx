import { useFetcher, Link } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { FileMetadataSection } from '@curvenote/scms-core';
import type { WorkVersionMetadata } from '@curvenote/scms-server';
import type { ChecksMetadataSection } from './checks.schema';

interface ContinueFormProps {
  title: string;
  metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
}

export function ContinueForm({ title, metadata }: ContinueFormProps) {
  const fetcher = useFetcher();

  // Check if title is non-empty
  const hasTitle = title && title.trim().length > 0;

  // Check if at least one file is uploaded
  const hasFiles = 'files' in metadata && metadata.files && Object.keys(metadata.files).length > 0;

  // Button is only enabled if both conditions are met
  const disabled = !hasTitle || !hasFiles;

  const handleContinue = () => {
    const formData = new FormData();
    formData.append('intent', 'confirm-work');
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
        <Link to="/app/works">Come back and finish this later</Link>
      </ui.Button>
    </div>
  );
}
