import { PassThrough } from 'node:stream';
import type { AppLoadContext, EntryContext } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { ServerRouter } from 'react-router';
import { isbot } from 'isbot';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';

export const streamTimeout = 30_000; // 30 seconds

const CSP_REPORT_PATH = '/app/resources/csp-report';
const ENFORCED_CSP = `frame-ancestors 'none'`;
const IS_PROD = process.env.NODE_ENV === 'production';
// 'unsafe-inline' is required for React Router's inline hydration script.
// 'unsafe-eval' is only permitted in non-production builds (Vite dev uses eval).
// 'apis.google.com' is required by the Firebase Auth popup/gapi loader.
const SCRIPT_SRC = IS_PROD
  ? `script-src 'self' 'unsafe-inline' https://apis.google.com`
  : `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com`;
// Browser-initiated connections only. Server→external calls are not covered by CSP.
// `*.googleapis.com` covers Firebase Auth (identitytoolkit / securetoken / www).
// `apis.google.com` is used by the Firebase Auth popup.
// Dev also needs Vite HMR over localhost WebSocket.
const CONNECT_SRC = IS_PROD
  ? `connect-src 'self' https://*.googleapis.com https://apis.google.com`
  : `connect-src 'self' https://*.googleapis.com https://apis.google.com ws://localhost:* ws://127.0.0.1:*`;
// Firebase Auth helper iframe lives at `<authDomain>/__/auth/iframe`; default auth
// domains are `<project>.firebaseapp.com` / `<project>.web.app`. Custom auth domains
// are not covered by this wildcard and will need to be added explicitly.
// `apis.google.com` covers the OAuth handler iframe used during the popup flow.
const FRAME_SRC = `frame-src https://*.firebaseapp.com https://*.web.app https://apis.google.com`;
const REPORT_ONLY_CSP = [
  `default-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  SCRIPT_SRC,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  // TODO: narrow `img-src` to configured CDN origins (see $config.cdn.*) instead of bare `https:`.
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  CONNECT_SRC,
  FRAME_SRC,
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to csp-endpoint`,
].join('; ');

function setSecurityHeaders(responseHeaders: Headers, request: Request) {
  const cspReportUrl = new URL(CSP_REPORT_PATH, request.url).toString();

  responseHeaders.set('Content-Security-Policy', ENFORCED_CSP);
  responseHeaders.set('Content-Security-Policy-Report-Only', REPORT_ONLY_CSP);
  // Modern Reporting API (Chromium 96+). Paired with the `report-to` directive above.
  responseHeaders.set('Reporting-Endpoints', `csp-endpoint="${cspReportUrl}"`);
  // Legacy Reporting API v0, kept for older browsers that understand `Report-To` but not `Reporting-Endpoints`.
  responseHeaders.set(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 60 * 60 * 24 * 30,
      endpoints: [{ url: cspReportUrl }],
    }),
  );
  responseHeaders.set('X-Frame-Options', 'DENY');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  responseHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const requestUrl = new URL(request.url);
  if (IS_PROD && requestUrl.protocol === 'https:') {
    responseHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadContext: AppLoadContext,
  // If you have middleware enabled:
  // loadContext: RouterContextProvider
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get('user-agent');

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady';

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => abort(),
      streamTimeout + 1000,
    );

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              // Clear the timeout to prevent retaining the closure and memory leak
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');
          setSecurityHeaders(responseHeaders, request);

          pipe(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );
  });
}
