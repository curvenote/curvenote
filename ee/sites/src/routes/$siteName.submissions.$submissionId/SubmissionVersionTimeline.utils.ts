import type { SubmissionDetailActivity, SubmissionDetailVersion } from './types.js';

export type SubmissionActivitiesByVersion = {
  grouped: Map<string, SubmissionDetailActivity[]>;
  submissionLevel: SubmissionDetailActivity[];
};

export type SubmissionTimelineSection =
  | {
      kind: 'version';
      key: string;
      date: string;
      version: SubmissionDetailVersion;
      versionNumber: number;
    }
  | {
      kind: 'submission-activity';
      key: string;
      date: string;
      activity: SubmissionDetailActivity;
    };

const SUBMISSION_TIMELINE_SECTION_KIND_RANK: Record<SubmissionTimelineSection['kind'], number> = {
  version: 0,
  'submission-activity': 1,
};

function compareNewestFirst(a: SubmissionTimelineSection, b: SubmissionTimelineSection) {
  if (a.date > b.date) return -1;
  if (a.date < b.date) return 1;
  return (
    SUBMISSION_TIMELINE_SECTION_KIND_RANK[a.kind] - SUBMISSION_TIMELINE_SECTION_KIND_RANK[b.kind]
  );
}

export function groupSubmissionActivitiesByVersion(
  activities: SubmissionDetailActivity[],
  submissionVersions: SubmissionDetailVersion[],
): SubmissionActivitiesByVersion {
  const grouped = new Map<string, SubmissionDetailActivity[]>();
  const submissionLevel: SubmissionDetailActivity[] = [];
  const versionIdSet = new Set(submissionVersions.map((version) => version.id));
  const workVersionIdToSubmissionVersionId = new Map(
    submissionVersions.map((version) => [version.site_work.version_id, version.id]),
  );

  for (const activity of activities) {
    const directVersionId = activity.submission_version?.id;
    const versionId =
      directVersionId && versionIdSet.has(directVersionId)
        ? directVersionId
        : activity.work_version?.id
          ? workVersionIdToSubmissionVersionId.get(activity.work_version.id)
          : undefined;

    if (!versionId) {
      submissionLevel.push(activity);
      continue;
    }

    const list = grouped.get(versionId) ?? [];
    list.push(activity);
    grouped.set(versionId, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) =>
      a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
    );
  }
  submissionLevel.sort((a, b) =>
    a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
  );

  return { grouped, submissionLevel };
}

export function getSubmissionTimelineSections(
  submissionVersions: SubmissionDetailVersion[],
  submissionLevelActivities: SubmissionDetailActivity[],
): SubmissionTimelineSection[] {
  return [
    ...submissionVersions.map((version, index) => ({
      kind: 'version' as const,
      key: `version-${version.id}`,
      date: version.date_created,
      version,
      versionNumber: submissionVersions.length - index,
    })),
    ...submissionLevelActivities.map((activity) => ({
      kind: 'submission-activity' as const,
      key: `submission-activity-${activity.id}`,
      date: activity.date_created,
      activity,
    })),
  ].sort(compareNewestFirst);
}

export function getSubmissionVersionBadgeTags(version: SubmissionDetailVersion): string[] {
  return version.tags ?? [];
}
