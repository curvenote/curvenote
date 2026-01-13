import {
  DEFAULT_REDIRECT,
  error405,
  httpError,
  MESSAGE_401,
  MESSAGE_403,
  MESSAGE_404,
} from '@curvenote/scms-core';
import type { Config } from '@/types/app-config.js';
import type { ClientDeploymentConfig, Context, SimpleNavItemType } from '@curvenote/scms-core';
import { redirect } from 'react-router';
import { userHasScopes } from './backend/scopes.helpers.server.js';

/**
 * Throws a redirect or an error based on the provided options.
 *
 * @param code - The error code to raise
 * @param opts - The options for the function.
 * @param opts.redirect - If true, a redirect will be thrown.
 * @param opts.redirectTo - The URL to redirect to if `redirect` is true. Defaults to `DEFAULT_REDIRECT`.
 * @param opts.headers - Additional headers to include in the response.
 *
 * @throws Will throw a redirect if `opts.redirect` is true, otherwise will throw a 401 error.
 */
export function throwRedirectOrError(
  code: number,
  message: string,
  opts: {
    redirect?: boolean;
    redirectTo?: string;
    headers?: Record<string, string>;
  },
) {
  if (opts.redirect ?? opts.redirectTo)
    throw redirect(opts.redirectTo ?? DEFAULT_REDIRECT, {
      headers: {
        'Cache-Control': 'no-store',
        ...opts.headers,
      },
    });
  else throw httpError(code, message, { headers: opts.headers });
}

/**
 * Throws a redirect or a 401 error based on the provided options.
 *
 * @param opts - The options for the function.
 * @param opts.redirect - If true, a redirect will be thrown.
 * @param opts.redirectTo - The URL to redirect to if `redirect` is true. Defaults to `DEFAULT_REDIRECT`.
 * @param opts.headers - Additional headers to include in the response.
 *
 * @throws Will throw a redirect if `opts.redirect` is true, otherwise will throw a 401 error.
 */
export function throwRedirectOr401(opts: {
  redirect?: boolean;
  redirectTo?: string;
  headers?: Record<string, string>;
}) {
  throwRedirectOrError(401, MESSAGE_401, opts);
}
export function throwRedirectOr403(opts: {
  redirect?: boolean;
  redirectTo?: string;
  headers?: Record<string, string>;
}) {
  throwRedirectOrError(403, MESSAGE_403, opts);
}
export function throwRedirectOr404(opts: {
  redirect?: boolean;
  redirectTo?: string;
  headers?: Record<string, string>;
}) {
  throwRedirectOrError(404, MESSAGE_404, opts);
}

/**
 * Ensures that the request method is one of the accepted methods and that the request body is valid JSON.
 * Throws an error if the method is not accepted or if the content-type header is not 'application/json'.
 *
 * @param {Request} request - The request object to validate.
 * @param {string[]} acceptMethods - An array of accepted HTTP methods.
 * @returns {Promise<any>} - A promise that resolves to the parsed JSON body of the request.
 * @throws {Error} - Throws a 405 error if the request method is not accepted.
 * @throws {Error} - Throws a 400 error if the content-type header is invalid or missing.
 * @throws {Error} - Throws a 400 error if the request body is not valid JSON.
 */
export async function ensureJsonBodyFromMethod(request: Request, acceptMethods: string[]) {
  if (!acceptMethods.includes(request.method)) throw error405();
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw httpError(400, 'invalid/missing content-type header');
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error(err);
    throw httpError(400, 'invalid request body');
  }
  return body;
}

/**
 * Checks if the given FormDataEntryValue is a string with a type guard.
 *
 * @param value - The value to check, which can be a FormDataEntryValue or null.
 * @returns A boolean indicating whether the value is a string.
 */
export function formValueIsString(value: FormDataEntryValue | null): value is string {
  return typeof value === 'string';
}

/**
 * Builds the client navigation configuration based on the provided context and navigation configuration.
 *
 * @param ctx - The context object containing user and scope information.
 * @param navConfig - An optional navigation configuration object with items array.
 * @returns A promise that resolves to the client deployment configuration's navigation object.
 *
 * This function performs the following steps:
 * 1. If no navigation configuration is provided, it returns an empty navigation object.
 * 2. Maps the navigation items, checking for scope requirements.
 * 3. Filters out any invalid navigation items.
 */
export async function buildClientNavigation(
  ctx: Context,
  navConfig?: Config['app']['navigation'],
): Promise<ClientDeploymentConfig['navigation']> {
  if (!navConfig || !ctx.user) {
    return { items: [], helpItem: undefined };
  }

  // Navigation is now always an object with items array
  const navConfigObj = navConfig as { items?: Array<SimpleNavItemType & { scopes?: string[] }> };
  const navItems = navConfigObj.items || [];
  const items = navItems
    .map((nav) => {
      if (nav.scopes && !userHasScopes(ctx.user, nav.scopes)) return undefined;
      return nav as SimpleNavItemType;
    })
    .filter((nav): nav is SimpleNavItemType => !!nav);

  // helpItem is processed separately in root.tsx with defaults applied
  return {
    items,
    helpItem: undefined,
  };
}

/**
 * Sanitizes user input by removing HTML tags and limiting length
 * @param text - The text to sanitize
 * @param maxLength - Maximum allowed length (default: 2000)
 * @returns Sanitized text
 */
export function sanitizeUserInput(text: string, maxLength: number = 2000): string {
  if (!text) return '';

  // Remove HTML tags first (before decoding entities)
  // This prevents decoded entities like &lt; and &gt; from being treated as tags
  let sanitized = text.replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, '');

  // Decode common HTML entities
  sanitized = sanitized
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}
