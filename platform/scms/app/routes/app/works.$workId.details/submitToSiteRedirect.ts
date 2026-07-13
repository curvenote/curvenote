type SubmitToSiteRedirectData = {
  siteName?: string;
  submissionVersionId?: string;
  redirectPath?: string;
};

/**
 * Resolve where to navigate after a successful submit-to-site. Prefers an explicit
 * redirectPath from the action (e.g. supplied by an extension), falls back to the
 * constructed submission URL, and returns undefined when the response carries no
 * destination.
 */
export function resolveSubmitRedirectTarget(
  data: SubmitToSiteRedirectData,
  basePath: string,
): string | undefined {
  const { redirectPath, siteName, submissionVersionId } = data;
  return (
    redirectPath ??
    (siteName && submissionVersionId
      ? `${basePath}/site/${siteName}/submission/${submissionVersionId}`
      : undefined)
  );
}
