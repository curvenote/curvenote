import { SectionWithHeading, primitives } from '@curvenote/scms-core';
import { GalleryHorizontalEnd } from 'lucide-react';
import type { Workflow } from '@curvenote/scms-core';
import type {
  SubmissionDetailActivity,
  SubmissionDetailSiteContext,
  SubmissionDetailVersion,
} from './types.js';
import { SubmissionVersionTimeline } from './SubmissionVersionTimeline.js';

export function Versions({
  workflow,
  submissionVersions,
  activities,
  canUpdateStatus,
  site,
  signature,
}: {
  workflow: Workflow;
  submissionVersions: SubmissionDetailVersion[];
  activities: SubmissionDetailActivity[];
  canUpdateStatus: boolean;
  site: SubmissionDetailSiteContext;
  signature: string;
}) {
  return (
    <SectionWithHeading heading="Timeline" icon={GalleryHorizontalEnd}>
      <primitives.Card lift className="p-8">
        <SubmissionVersionTimeline
          workflow={workflow}
          submissionVersions={submissionVersions}
          activities={activities}
          canUpdateStatus={canUpdateStatus}
          site={site}
          signature={signature}
        />
      </primitives.Card>
    </SectionWithHeading>
  );
}
