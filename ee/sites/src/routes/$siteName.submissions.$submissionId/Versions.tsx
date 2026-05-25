import { SectionWithHeading, VersionsListing, primitives } from '@curvenote/scms-core';
import { GalleryHorizontalEnd } from 'lucide-react';
import type { SiteDTO, SubmissionVersionDTO } from '@curvenote/common';
import type { Workflow, WorkflowTransition } from '@curvenote/scms-core';
import type { SubmissionDetailSiteContext, SubmissionDetailVersion } from './types.js';

export function Versions({
  workflow,
  submissionVersions,
  canUpdateStatus,
  site,
  signature,
}: {
  workflow: Workflow;
  submissionVersions: SubmissionDetailVersion[];
  canUpdateStatus: boolean;
  site: SubmissionDetailSiteContext;
  signature: string;
}) {
  return (
    <SectionWithHeading heading="Versions" icon={GalleryHorizontalEnd}>
      <primitives.Card lift className="p-8">
        <VersionsListing
          workflow={workflow}
          items={
            submissionVersions as (SubmissionVersionDTO & {
              transition?: WorkflowTransition;
            })[]
          }
          canUpdateStatus={canUpdateStatus}
          site={site as SiteDTO}
          signature={signature}
        />
      </primitives.Card>
    </SectionWithHeading>
  );
}
