import { List } from 'lucide-react';
import { SectionWithHeading, ui } from '@curvenote/scms-core';
import { WorkTitleForm } from './WorkTitleForm';
import { AuthorMetadataForm } from './AuthorMetadataForm';
import type { AuthorFieldMetadata } from './mystAuthorAdapters';

export interface CaptureMetadataSectionProps {
  title: string;
  authorMetadata: AuthorFieldMetadata;
  onAuthorMetadataChange: (value: AuthorFieldMetadata) => void;
}

/**
 * Simplified metadata section (legacy): title + structured authors form.
 * Shown when the user does not have the app:works:metadata-extract scope.
 */
export function CaptureMetadataSection({
  title,
  authorMetadata,
  onAuthorMetadataChange,
}: CaptureMetadataSectionProps) {
  return (
    <SectionWithHeading
      heading="Add a Title"
      icon={<List className="w-5 h-5" />}
      className="space-y-4 max-w-3xl"
    >
      <p className="text-muted-foreground">
        Using a meaningful title will help you find this paper again later, please add one.
      </p>
      <ui.Card className="px-6 pt-4 pb-6 space-y-4">
        <WorkTitleForm title={title} />
        <AuthorMetadataForm value={authorMetadata} onChange={onAuthorMetadataChange} />
      </ui.Card>
    </SectionWithHeading>
  );
}
