import type { SubmissionDetailActivity, SubmissionDetailVersion } from './types.js';

export type SubmissionActivitiesByVersion = {
  grouped: Map<string, SubmissionDetailActivity[]>;
  submissionLevel: SubmissionDetailActivity[];
};

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
