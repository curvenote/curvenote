/** JSON resource route for submission version timelines (sites extension). */
export function submissionVersionsTimelineUrl(siteName: string, submissionId: string) {
  return `/app/sites/${encodeURIComponent(siteName)}/submissions/${encodeURIComponent(submissionId)}/versions`;
}

/** JSON resource route for work version timelines (works app). */
export function workVersionsTimelineUrl(workId: string) {
  return `/app/works/${encodeURIComponent(workId)}/versions`;
}

/** Full submission versions listing on the submission detail page. */
export function submissionVersionsSeeAllUrl(siteName: string, submissionId: string) {
  return `/app/sites/${encodeURIComponent(siteName)}/submissions/${encodeURIComponent(submissionId)}`;
}

/** Full work version timeline on the work details page. */
export function workVersionsSeeAllUrl(workId: string) {
  return `/app/works/${encodeURIComponent(workId)}/details`;
}
