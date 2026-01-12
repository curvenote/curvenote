export * from './analytics.js';
export * from './authors.js';
export * from './cn.js';
export * from './coerceToList.js';
export * from './coerceToObject.js';
export * from './date.js';
export * from './delay.js';
export * from './formatDate.js';
export * from './formatNumber.js';
export * from './getFetcherField.js';
export * from './metaUtils.js';
export * from './localStorage.js';
export * from './pagination.js';
export * from './plural.js';
export * from './sleep.js';
export * from './status.js';
export * from './truncate.js';
export * from './wildcard.js';
export * from './formatZodError.js';

export const version = 'v1';

export function withApiBaseUrl(req: Request) {
  const url = new URL(req.url);
  return (path: string) =>
    `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/${version}${path}`;
}

export function withBaseUrl(req: Request) {
  const url = new URL(req.url);
  return (path: string) =>
    `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${path}`;
}

export function httpError(status: number, message: string, body?: any, init?: ResponseInit) {
  // Reduce logging noise during tests - only log unexpected errors
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.APP_CONFIG_ENV === 'test';
  const isExpectedError = status >= 400 && status < 500; // 4xx errors are often expected

  if (!isTestEnv || !isExpectedError) {
    console.error(`HTTP Error ${status}: ${message}`);
    if (body) console.error(body);
  }

  // Sanitize the message to remove non-ASCII characters that can't be used in statusText
  const sanitizedMessage = message.replace(/[^\x20-\x7E]/g, '?');

  return new Response(JSON.stringify({ ...body, status, message }), {
    status,
    statusText: sanitizedMessage,
    ...init,
  });
}

export const MESSAGE_401 = 'Not Authorized.';
export const MESSAGE_403 = 'Insufficient permissions.';
export const MESSAGE_404 = 'Not found.';

// TODO move to utils.server
export function error401(message?: string, init?: ResponseInit) {
  if (message) console.error(message);
  return httpError(401, message ?? MESSAGE_401, init);
}

export function error403(message?: string) {
  return httpError(403, message ?? MESSAGE_403);
}

export function error404(message?: string) {
  return httpError(404, message ?? MESSAGE_404);
}

export function error405(message?: string) {
  return httpError(405, message ?? 'Method not allowed.');
}

export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length > 3 && email.includes('@');
}

export const DEFAULT_REDIRECT = '/';

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT,
) {
  if (!to || typeof to !== 'string') {
    return defaultRedirect;
  }

  if (!to.startsWith('/') || to.startsWith('//')) {
    return defaultRedirect;
  }

  return to;
}

export function looksLikeUUID(maybeUuid: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(maybeUuid);
}

export function isSafeSlug(slug: string) {
  return /^[a-zA-Z0-9-_.]+$/.test(slug);
}

/**
 * Ensures a URL ends with a trailing slash
 */
export function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`;
}

export class ErrorWithObject extends Error {
  constructor(
    message: string,
    public data?: any,
  ) {
    super(message);
    this.name = 'ErrorWithObject';
  }
}
