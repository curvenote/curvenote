/**
 * Browser navigations send Sec-Fetch-Dest: document. Client `fetch()` (React Router
 * single-fetch revalidation, polling, resource loads) typically sends `empty`.
 *
 * Suppress server-side Segment track calls for GET/HEAD data fetches so loader
 * re-runs do not duplicate view-style metrics. Mutations (POST, etc.) are unchanged.
 */
export function shouldSuppressTrackEventForDataFetch(request: Request): boolean {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  return request.headers.get('Sec-Fetch-Dest') === 'empty';
}
