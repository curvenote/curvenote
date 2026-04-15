import { MESSAGE_404 } from '@curvenote/scms-core';
import { NOT_FOUND_PUBLIC_BURST, vercelCacheHeaders } from './vercel-cache';

function probe404Response(): Response {
  return Response.json(
    { status: 404, message: MESSAGE_404 },
    { status: 404, headers: vercelCacheHeaders(NOT_FOUND_PUBLIC_BURST) },
  );
}

/**
 * If a route segment is clearly not a real work id / slug / version id (path traversal,
 * huge payload, static-file extension), return a cached 404 without touching the DB.
 */
export function pathSegmentProbe404IfObvious(segment: string): Response | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return probe404Response();
  }
  if (decoded.length > 200) return probe404Response();
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return probe404Response();
  if (/[/\\]/.test(decoded)) return probe404Response();
  if (decoded.includes('..')) return probe404Response();
  return null;
}
