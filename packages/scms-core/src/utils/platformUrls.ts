/**
 * Canonical app paths for deep links (Slack, email, etc.).
 */

/** App-router path to a submission under a site workspace (`/app/sites/...`). */
export function siteSubmissionAppPath(siteName: string, submissionId: string) {
  return `/app/sites/${siteName}/submissions/${submissionId}`;
}

export function asSiteSubmissionUrl(
  asBaseUrl: (path: string) => string,
  siteName?: string,
  submissionId?: string,
) {
  if (!siteName || !submissionId) return undefined;
  return asBaseUrl(siteSubmissionAppPath(siteName, submissionId));
}

export function platformMessageAppPath(messageId: string) {
  return `/app/platform/messages/${messageId}`;
}

export function asPlatformMessageUrl(asBaseUrl: (path: string) => string, messageId: string) {
  return asBaseUrl(platformMessageAppPath(messageId));
}

/**
 * App-router path to a work root page (e.g. `/app/works/${workId}`).
 * Note: submission routes are site-scoped; the work root itself is global.
 */
export function siteWorkAppPath(workId: string) {
  return `/app/works/${workId}`;
}

/**
 * Full URL for a work root.
 *
 * `siteName` is accepted for API symmetry with other helpers but is currently unused.
 */
export function asSiteWorkUrl(
  asBaseUrl: (path: string) => string,
  _siteName?: string,
  workId?: string,
) {
  if (!workId) return undefined;
  return asBaseUrl(siteWorkAppPath(workId));
}

/** App-router path to work integrity checks for a work. */
export function workIntegrityAppPath(workId: string) {
  return `/app/works/${workId}/work-integrity`;
}

export function asWorkIntegrityUrl(asBaseUrl: (path: string) => string, workId?: string) {
  if (!workId) return undefined;
  return asBaseUrl(workIntegrityAppPath(workId));
}

/** App-router path to download a text-integrity similarity PDF for a check run. */
export function textIntegrityPdfDownloadAppPath(checkRunId: string) {
  return `/app/checks-text-integrity/download-pdf/${checkRunId}`;
}

export function asTextIntegrityPdfDownloadUrl(
  asBaseUrl: (path: string) => string,
  checkRunId?: string,
) {
  if (!checkRunId) return undefined;
  return asBaseUrl(textIntegrityPdfDownloadAppPath(checkRunId));
}
