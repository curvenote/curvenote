/**
 * Fetch wrapper for SCMS task runners inside Docker.
 *
 * SCMS signs MinIO/S3 URLs as http://127.0.0.1:9000/... which is unreachable from a
 * container. Rewrite the connect host to host.docker.internal (or TASK_CONVERTER_HOST_GATEWAY)
 * while keeping Host: 127.0.0.1:9000 so SigV4 / MinIO signatures still validate.
 *
 * Auto-detects `/.dockerenv` (override with TASK_CONVERTER_REWRITE_LOCALHOST=0|1).
 */

import { existsSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

export function shouldRewriteLocalhostForContainer(): boolean {
  if (process.env.TASK_CONVERTER_REWRITE_LOCALHOST === '0') return false;
  if (process.env.TASK_CONVERTER_REWRITE_LOCALHOST === '1') return true;
  try {
    return existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

function resolveUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function bodyToNodeReadable(
  body: BodyInit | null | undefined,
): Promise<Readable | undefined> {
  if (body == null) return undefined;
  if (typeof body === 'string' || body instanceof Uint8Array || Buffer.isBuffer(body)) {
    return Readable.from(Buffer.from(body as string | Uint8Array));
  }
  if (body instanceof ReadableStream) {
    return Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  }
  if (body instanceof Blob) {
    return Readable.from(Buffer.from(await body.arrayBuffer()));
  }
  // FormData / URLSearchParams / other — materialize via Request
  const req = new Request('http://local.invalid', { method: 'POST', body });
  return Readable.from(Buffer.from(await req.arrayBuffer()));
}

function mergeOutgoingHeaders(
  signedHost: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { host: signedHost };
  const apply = (source: HeadersInit | undefined) => {
    if (!source) return;
    const h = new Headers(source);
    h.forEach((value, key) => {
      if (key.toLowerCase() === 'host') return;
      headers[key] = value;
    });
  };
  if (input instanceof Request) apply(input.headers);
  apply(init?.headers);
  return headers;
}

/**
 * Drop-in fetch that rewrites localhost CDN URLs when running in Docker.
 * Forwards method/headers/body from Request + init, and honors AbortSignal.
 */
export async function dockerAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const urlStr = resolveUrlString(input);
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return fetch(input, init);
  }

  const rewrite =
    shouldRewriteLocalhostForContainer() &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');

  if (!rewrite) {
    return fetch(input, init);
  }

  const connectHost = process.env.TASK_CONVERTER_HOST_GATEWAY ?? 'host.docker.internal';
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  console.log(
    `[dockerAwareFetch] ${method} ${parsed.host}${parsed.pathname} → ${connectHost}:${port}`,
  );

  const headers = mergeOutgoingHeaders(parsed.host, input, init);

  const bodySource =
    init?.body !== undefined
      ? init.body
      : input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD'
        ? input.body
        : null;
  const bodyStream = await bodyToNodeReadable(bodySource);
  const lib = parsed.protocol === 'https:' ? https : http;
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);

  let incoming: http.IncomingMessage;
  try {
    incoming = await new Promise<http.IncomingMessage>((resolve, reject) => {
      let settled = false;
      const settle =
        <T>(fn: (value: T) => void) =>
        (value: T) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          fn(value);
        };
      const resolveOnce = settle(resolve);
      const rejectOnce = settle(reject);

      const req = lib.request(
        {
          protocol: parsed.protocol,
          hostname: connectHost,
          port,
          path: `${parsed.pathname}${parsed.search}`,
          method,
          headers,
        },
        resolveOnce,
      );
      const onAbort = () => {
        req.destroy();
      };
      if (signal) {
        if (signal.aborted) {
          rejectOnce(signal.reason ?? new Error('The operation was aborted'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      req.on('error', (err) => {
        if (signal?.aborted) {
          rejectOnce(signal.reason ?? new Error('The operation was aborted'));
          return;
        }
        rejectOnce(err);
      });
      if (bodyStream) {
        bodyStream.on('error', rejectOnce);
        bodyStream.pipe(req);
      } else {
        req.end();
      }
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `dockerAwareFetch ${method} ${parsed.host} via ${connectHost}:${port} failed: ${cause}`,
    );
  }

  const chunks: Buffer[] = [];
  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) responseHeaders.append(key, v);
    } else {
      responseHeaders.set(key, value);
    }
  }

  return new Response(Buffer.concat(chunks), {
    status: incoming.statusCode ?? 500,
    statusText: incoming.statusMessage ?? '',
    headers: responseHeaders,
  });
}
