import type { Response } from 'express';
import fs from 'node:fs';

/**
 * Options for a single JSON request to the SCMS API (PATCH or PUT).
 * Used to DRY fetch, status check, and pubsub error handling.
 */
export type ScmsRequestOptions = {
  method: 'PATCH' | 'PUT';
  url: string;
  body: Record<string, unknown>;
  authToken: string;
  res: Response;
  /** Short label for logs and errors, e.g. "patching job" / "putting status" */
  contextLabel: string;
  loggingOnlyMode?: boolean;
};

/**
 * Send a JSON PATCH or PUT to the SCMS API.
 * On 200: logs success and returns.
 * On non-200 or throw: calls pubsubError(res, ...) and returns (caller should treat as failure).
 */
export async function scmsRequest(options: ScmsRequestOptions): Promise<void> {
  const { method, url, body, authToken, res, contextLabel, loggingOnlyMode } = options;
  console.log(`${method} ${url}`, JSON.stringify(body));
  if (loggingOnlyMode) {
    console.log('[loggingOnlyMode] Skipping request');
    return;
  }
  try {
    const response = await fetch(url, {
      method,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    if (response.status === 200) {
      console.log(`Successfully ${contextLabel}: ${url}`);
      return;
    }
    pubsubError(`Bad response ${contextLabel}: ${response.status} - ${response.statusText}`, res);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    pubsubError(`Error ${contextLabel}: ${message}`, res);
  }
}

/**
 * Check if the response has already been sent.
 */
export function alreadySent(res: Response) {
  return res.headersSent;
}

/**
 * Send a given response from the app.
 *
 * If a response has already been sent, throws an error.
 */
export function send(res: Response, status: number, body?: Record<string, any>) {
  if (alreadySent(res)) {
    throw new Error('Error during job execution');
  }
  return res.status(status).send(body);
}

/**
 * Log an error message and return a response.
 *
 * If 'retry = true', the response status will be 400; this
 * tells pubsub to retry the job. If 'retry = false' (the default) the response status will
 * be 200 and pubsub will not retry the job.
 */
export function pubsubError(message: string, res: Response, retry = false) {
  const status = retry ? 400 : 200;
  console.error(message);
  return send(res, status, { errors: [message] });
}

/**
 * Return full API URL from path; protocol/host are from job URL
 */
export function apiUrlFromJobUrl(url: string): string {
  const parsedUrl = new URL(url);
  return `${parsedUrl.protocol}//${parsedUrl.host}/v1/`;
}

export function removeFolder(folder?: string) {
  if (folder && fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true });
  }
}

export function hyphenatedFromDate(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
