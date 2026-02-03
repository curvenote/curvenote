import type { SubmissionWithVersionsAndSite, WorkVersionWithSubmissionVersions } from './types';

/**
 * Get unique submissions from work versions using client side transformation
 *
 * @param versions
 * @returns an array of unique submissions, with their submission versions sorted by date_created descending
 */
export function getUniqueSubmissions(versions: WorkVersionWithSubmissionVersions[]) {
  const submissions: Record<string, SubmissionWithVersionsAndSite> = {};
  versions.forEach((v) => {
    v.submissionVersions.forEach((sv) => {
      // Never surface draft submission versions in work details.
      if (sv.status === 'DRAFT') return;
      if (submissions[sv.submission_id]) {
        submissions[sv.submission_id].versions.push(sv);
      } else {
        submissions[sv.submission_id] = {
          ...sv.submission,
          versions: [sv],
        };
      }
    });
  });
  return Object.values(submissions)
    // If a submission only has draft versions, omit the submission entirely.
    .filter((s) => s.versions.length > 0)
    .map((s) => ({
      ...s,
      versions: s.versions.sort((a, b) => {
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      }),
    }))
    .sort((a, b) => {
      return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
    });
}
