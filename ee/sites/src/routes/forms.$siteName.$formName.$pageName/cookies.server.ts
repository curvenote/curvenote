/**
 * Cookie helpers for forms draft: get/set/clear draft objectId cookie.
 */

const DRAFT_COOKIE_NAME = 'forms_draft_id';
const DRAFT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const DRAFT_OBJECT_TYPE = 'forms-draft';

export function getDraftObjectIdFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${DRAFT_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function setDraftObjectIdCookie(
  objectId: string,
  siteName: string,
  formName: string,
): string {
  const path = `/forms/${siteName}/${formName}`;
  return `${DRAFT_COOKIE_NAME}=${encodeURIComponent(objectId)}; Path=${path}; Max-Age=${DRAFT_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`;
}

/** Returns Set-Cookie header value to clear the draft cookie (same Path, Max-Age=0). */
export function clearDraftCookie(siteName: string, formName: string): string {
  const path = `/forms/${siteName}/${formName}`;
  return `${DRAFT_COOKIE_NAME}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export const DRAFT_OBJECT_TYPE_CONST = DRAFT_OBJECT_TYPE;
