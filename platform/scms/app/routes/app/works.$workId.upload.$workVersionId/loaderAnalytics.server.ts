/**
 * Fire WORK_VIEWED only on full document navigations, not client loader revalidations
 * (upload/remove/title updates re-run the loader without a new "page view").
 */
export function shouldTrackWorkViewedOnLoader(request: Request): boolean {
  const dest = request.headers.get('Sec-Fetch-Dest');
  if (dest === 'document') return true;
  const mode = request.headers.get('Sec-Fetch-Mode');
  if (mode === 'navigate') return true;
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('text/html');
}
