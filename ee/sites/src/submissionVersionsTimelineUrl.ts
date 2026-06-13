/** JSON resource route for the shared {@link @curvenote/scms-core#VersionTimelineHoverCard}. */
export function submissionVersionsTimelineUrl(siteName: string, submissionId: string) {
  return `/app/sites/${encodeURIComponent(siteName)}/submissions/${encodeURIComponent(submissionId)}/versions`;
}
