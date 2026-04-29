import { List } from 'lucide-react';
import { SectionWithHeading, ui } from '@curvenote/scms-core';
import { WorkTitleForm } from './WorkTitleForm';
import { AuthorsForm } from './AuthorsForm';

export interface CaptureMetadataSectionProps {
  title: string;
  authors: string;
}

/**
 * Simplified metadata section (legacy): title + authors form.
 * Shown when the user does not have the app:works:metadata-preview scope.
 */
export function CaptureMetadataSection({ title, authors }: CaptureMetadataSectionProps) {
  return (
    <SectionWithHeading
      heading="Capture Your Metadata"
      icon={<List className="w-5 h-5" />}
      className="space-y-4 max-w-3xl"
    >
      <p className="text-muted-foreground">
        We'll need some metadata about your work, we have started with the filename but please
        adjust as needed.
      </p>
      <ui.Card className="px-6 pt-4 pb-6 space-y-4">
        <WorkTitleForm title={title} />
        <AuthorsForm initialAuthors={authors} />
      </ui.Card>
    </SectionWithHeading>
  );
}
