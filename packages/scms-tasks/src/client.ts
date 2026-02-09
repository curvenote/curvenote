import type { Response } from 'express';
import { send, alreadySent, pubsubError } from './utils.js';

export class SCMSJobClient {
  readonly jobUrl: string;
  readonly statusUrl: string;
  readonly handshake: string;
  readonly loggingOnlyMode: boolean;

  constructor(jobUrl: string, statusUrl: string, handshake: string, loggingOnlyMode = false) {
    this.jobUrl = jobUrl;
    this.statusUrl = statusUrl;
    this.handshake = handshake;
    this.loggingOnlyMode = loggingOnlyMode;
  }

  /**
   * Update job as completed, with a log message
   *
   * This will return a 200 response, unless this update itself fails; then it will
   * return a 400 response.
   */
  async completed(res: Response, message: string, results: Record<string, any>): Promise<Response> {
    if (this.loggingOnlyMode) {
      console.log('[loggingOnlyMode] Skipping COMPLETED request');
      return alreadySent(res) ? res : send(res, 200);
    }
    await this.patchJobStatus('COMPLETED', results, message, res);
    return send(res, 200);
  }

  /**
   * Update job as failed, with a log message
   *
   * This will return a 200 response (a failed job is still successfully
   * completed), unless this update itself fails; then it will
   * return a 400 response.
   */
  async failed(res: Response, message: string, results?: Record<string, any>): Promise<Response> {
    if (this.loggingOnlyMode) {
      console.log('[loggingOnlyMode] Skipping FAILED request');
      return alreadySent(res) ? res : send(res, 200);
    }
    await this.patchJobStatus('FAILED', results, message, res);
    return alreadySent(res) ? res : send(res, 200);
  }

  /**
   * Update job as running, with a log message
   *
   * This will return nothing so the job may continue. If the update itself
   * fails, a 400 response will be sent and subsequent processing will be
   * stopped.
   */
  async running(res: Response, message: string, results?: Record<string, any>): Promise<void> {
    if (this.loggingOnlyMode) {
      console.log('[loggingOnlyMode] Skipping RUNNING request');
      return;
    }
    await this.patchJobStatus('RUNNING', results, message, res);
  }

  /**
   * Send PATCH request to client url
   *
   * Request includes handshake, job status, and log message.
   * Messages are also logged on the server, along with PATCH request status.
   *
   * If the PATCH request responds 200, this function returns undefined, and the job may continue.
   * If the PATCH request errors or responds other than 200, this function returns a
   * pubsub error, telling the job to retry.
   */
  async patchJobStatus(
    status: string,
    results: Record<string, any> | undefined,
    message: string,
    res: Response,
  ): Promise<Response | undefined> {
    const body: Record<string, any> = { status, message };
    if (results) body.results = results;
    console.log(`PATCH ${this.jobUrl}`, JSON.stringify(body));
    if (this.loggingOnlyMode) {
      console.log('[loggingOnlyMode] Skipping PATCH request');
      return;
    }
    try {
      const response = await fetch(this.jobUrl, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.handshake}` },
      });

      if (response.status === 200) {
        console.log(`Successfully patched job: ${this.jobUrl}`);
        return;
      }
      return pubsubError(
        `Bad response patching job: ${response.status} - ${response.statusText}`,
        res,
      );
    } catch (error: any) {
      return pubsubError(`Error patching job: ${error.message}`, res);
    }
  }

  /**
   * Sent a POST request to the SCMS API with a json body
   *
   * @param pathname
   * @param body
   */
  async putSubmissionStatus(status: string, userId: string, res: Response) {
    const body: Record<string, any> = { status, userId };
    console.log(`PUT ${this.statusUrl}`, JSON.stringify(body));
    if (this.loggingOnlyMode) {
      console.log('[loggingOnlyMode] Skipping PUT request');
      return;
    }
    try {
      const response = await fetch(this.statusUrl, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.handshake}` },
      });

      if (response.status === 200) {
        console.log(`Successfully put status: ${this.statusUrl}`);
        return;
      }
      return pubsubError(
        `Bad response putting status: ${response.status} - ${response.statusText}`,
        res,
      );
    } catch (error: any) {
      return pubsubError(`Error putting status: ${error.message}`, res);
    }
  }
}
