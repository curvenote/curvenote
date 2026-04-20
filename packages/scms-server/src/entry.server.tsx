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
const REPORT_ONLY_CSP = [
  `default-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`,
  `style-src 'self' 'unsafe-inline' https:`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data: https:`,
  `connect-src 'self' https: wss:`,
  `frame-src 'none'`,
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to csp-endpoint`,
].join('; ');

function setSecurityHeaders(responseHeaders: Headers, request: Request) {
  const cspReportUrl = new URL(CSP_REPORT_PATH, request.url).toString();

  responseHeaders.set('Content-Security-Policy', ENFORCED_CSP);
  responseHeaders.set('Content-Security-Policy-Report-Only', REPORT_ONLY_CSP);
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
  if (process.env.NODE_ENV === 'production' && requestUrl.protocol === 'https:') {
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
