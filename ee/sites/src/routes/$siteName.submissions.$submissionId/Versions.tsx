import { SectionWithHeading, primitives } from '@curvenote/scms-core';
import { GalleryHorizontalEnd } from 'lucide-react';
import type { TimelineCheckServiceRunRow, Workflow } from '@curvenote/scms-core';
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
  checkServiceRunsByWorkVersionId,
  canUpdateStatus,
  site,
  signature,
}: {
  workflow: Workflow;
  submissionVersions: SubmissionDetailVersion[];
  activities: SubmissionDetailActivity[];
  checkServiceRunsByWorkVersionId: Record<string, TimelineCheckServiceRunRow[]>;
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
          checkServiceRunsByWorkVersionId={checkServiceRunsByWorkVersionId}
          canUpdateStatus={canUpdateStatus}
          site={site}
          signature={signature}
        />
      </primitives.Card>
    </SectionWithHeading>
  );
}
