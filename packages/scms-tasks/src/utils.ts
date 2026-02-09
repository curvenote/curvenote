import type { Response } from 'express';
import fs from 'node:fs';

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
