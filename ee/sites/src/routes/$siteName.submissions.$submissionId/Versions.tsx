import { SectionWithHeading, VersionsListing, primitives } from '@curvenote/scms-core';
import { GalleryHorizontalEnd } from 'lucide-react';
import type { SiteDTO, SubmissionVersionDTO } from '@curvenote/common';
import type { Workflow, WorkflowTransition } from '@curvenote/scms-core';

export function Versions({
  workflow,
  submissionVersions,
  canUpdateStatus,
  site,
  signature,
}: {
  workflow: Workflow;
  submissionVersions: (SubmissionVersionDTO & { transition?: WorkflowTransition })[];
  canUpdateStatus: boolean;
  site: SiteDTO;
  signature: string;
}) {
  return (
    <SectionWithHeading heading="Versions" icon={GalleryHorizontalEnd}>
      <primitives.Card lift className="p-8">
        <VersionsListing
          workflow={workflow}
          items={submissionVersions}
          canUpdateStatus={canUpdateStatus}
          site={site}
          signature={signature}
        />
      </primitives.Card>
    </SectionWithHeading>
  );
}
