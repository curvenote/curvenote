import { useState } from 'react';
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
  const [showAuthorsForm, setShowAuthorsForm] = useState(authors.trim().length > 0);

  return (
    <SectionWithHeading
      heading="Add a Title"
      icon={<List className="w-5 h-5" />}
      className="space-y-4 max-w-3xl"
    >
      <p className="text-muted-foreground">
        Adding a meaningful title now, will help you find it later. Please add a meaningful title.
      </p>
      <ui.Card className="px-6 pt-4 pb-6 space-y-4">
        <WorkTitleForm title={title} />
        <AuthorsForm initialAuthors={authors} show={showAuthorsForm} />
        {!showAuthorsForm ? (
          <div className="flex justify-end">
            <ui.Button
              type="button"
              variant="link"
              className="px-0 py-0 h-auto text-xs font-normal"
              onClick={() => setShowAuthorsForm(true)}
            >
              + Add Authors
            </ui.Button>
          </div>
        ) : null}
      </ui.Card>
    </SectionWithHeading>
  );
}
