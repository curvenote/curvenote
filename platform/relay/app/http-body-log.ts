import { createMiddleware } from "hono/factory";
import { isHttpAccessLoggingEnabled } from "./http-access-log.js";

const MAX_BODY_CHARS = 8_192;

const SENSITIVE_KEY =
  /password|secret|token|apikey|api_key|authorization|credentials|bearer|webhooksigningsecret|signingsecret/i;

const SENSITIVE_HEADER =
  /^authorization$|^cookie$|^set-cookie$|^x-api-key$/i;

const MAX_HEADER_VALUE_CHARS = 256;

/** Safe header snapshot for logs (redacts auth/cookies). */
export function headersForLog(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADER.test(lower)) {
      out[key] = "[REDACTED]";
    } else if (value.length > MAX_HEADER_VALUE_CHARS) {
      out[key] = `${value.slice(0, MAX_HEADER_VALUE_CHARS)}…`;
    } else {
      out[key] = value;
    }
  });
  return out;
}

function isBodyLoggingEnvEnabled(): boolean {
  const v = process.env.HTTP_LOG_BODIES?.toLowerCase();
  if (!v || v === "0" || v === "false" || v === "no") {
    return false;
  }
  return true;
}

/** Request/response payload logging; only when access logging is also on. */
export function isHttpBodyLoggingEnabled(): boolean {
  return isHttpAccessLoggingEnabled() && isBodyLoggingEnvEnabled();
}

export function truncateForLog(text: string, max = MAX_BODY_CHARS): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…(truncated, ${text.length} chars)`;
}

export function redactSensitiveInJson(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveInJson(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitiveInJson(v);
      }
    }
    return out;
  }
  return value;
}

function safePreview(raw: string, contentType: string): string {
  const ct = contentType.toLowerCase();
  if (
    ct.includes("application/json") ||
    ct.includes("text/") ||
    ct.includes("application/x-www-form-urlencoded") ||
    !ct
  ) {
    const trimmed = raw.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return truncateForLog(
          JSON.stringify(redactSensitiveInJson(parsed), null, 0),
        );
      } catch {
        /* fall through */
      }
    }
    return truncateForLog(raw);
  }
  return `[body omitted: ${contentType || "unknown type"}]`;
}

async function readBodyPreview(
  res: Response,
): Promise<{ preview: string; error?: string }> {
  try {
    const clone = res.clone();
    const ct = clone.headers.get("content-type") ?? "";
    const raw = await clone.text();
    return { preview: safePreview(raw, ct) };
  } catch {
    return { preview: "", error: "unreadable" };
  }
}

/**
 * Logs request + response: sanitized headers, bodies (truncated), and status.
 * Enable with HTTP_LOG_BODIES=1 alongside normal HTTP access logging rules.
 */
export const httpBodyLogger = createMiddleware(async (c, next) => {
  if (!isHttpBodyLoggingEnabled()) {
    await next();
    return;
  }

  const path = c.req.path;
  if (path.startsWith("/assets")) {
    await next();
    return;
  }

  const requestHeaders = headersForLog(c.req.raw.headers);

  let reqPreview = "";
  try {
    const clone = c.req.raw.clone();
    const ct = clone.headers.get("content-type") ?? "";
    const raw = await clone.text();
    reqPreview = safePreview(raw, ct);
  } catch {
    reqPreview = "[request body unreadable]";
  }

  await next();

  const responseHeaders = headersForLog(c.res.headers);
  const { preview: resPreview, error: resErr } = await readBodyPreview(c.res);
  const line = {
    msg: "http_payload",
    method: c.req.method,
    path,
    requestHeaders,
    requestBody: reqPreview || undefined,
    responseHeaders,
    responseBody: resErr ? `[${resErr}]` : resPreview || undefined,
    status: c.res.status,
  };
  console.info(JSON.stringify(line));
});
