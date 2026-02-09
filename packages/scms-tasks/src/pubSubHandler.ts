/**
 * Pub/Sub handler wrapper for SCMS job handlers (e.g. converter).
 *
 * Validates request/message/attributes/data, creates temp folder and job client,
 * decodes the JSON payload, then invokes the provided handler with (client,
 * attributes, payload, tmpFolder, res). On success the handler is responsible
 * for putSubmissionStatus and completed(); the wrapper only removes the temp
 * folder. On error the wrapper handles cleanup, putSubmissionStatus(failureState),
 * and failed().
 */

import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { removeFolder, pubsubError } from './utils.js';
import { SCMSJobClient } from './client.js';

/**
 * Message attributes structure expected from the pub/sub system
 */
export type Attributes = {
  userId: string;
  successState: string;
  failureState: string;
  statusUrl: string;
  jobUrl: string;
  handshake: string;
};

const REQUIRED_ATTRS: (keyof Attributes)[] = [
  'jobUrl',
  'statusUrl',
  'handshake',
  'successState',
  'failureState',
  'userId',
];

/**
 * Context passed to the converter handler: client, attributes, decoded payload, temp folder, and response (for progress updates).
 */
export type HandlerContext<TPayload = unknown> = {
  client: SCMSJobClient;
  attributes: Attributes;
  payload: TPayload;
  tmpFolder: string;
  res: Response;
};

/**
 * Optional result from a successful handler (e.g. for typing; success path is handler responsibility).
 */
export type HandlerSuccessResult = {
  message?: string;
  taskId?: string;
  [key: string]: unknown;
};

/**
 * Converter handler: receives (client, attributes, payload, tmpFolder, res).
 * On success the handler must call putSubmissionStatus and completed(); then the wrapper removes the temp folder.
 * Throw on failure (wrapper handles cleanup, putSubmissionStatus(failureState), failed()).
 */
export type ConverterHandler<TPayload = unknown> = (
  ctx: HandlerContext<TPayload>,
) => Promise<HandlerSuccessResult | void>;

/**
 * Wraps the Pub/Sub POST boilerplate and calls the given handler with (client, attributes, payload, tmpFolder, res).
 *
 * - Validates body, message, attributes, data
 * - Creates temp folder, validates required attributes, decodes base64 data to JSON
 * - Creates SCMSJobClient and calls client.running()
 * - Invokes handler(ctx)
 * - On success: handler is responsible for putSubmissionStatus and completed(); wrapper then removes folder
 * - On error: removes folder, putSubmissionStatus(failureState), failed(res, ...)
 *
 * @param handler - Function that receives client, attributes, decoded payload, tmpFolder, and res
 * @returns Express request handler (req, res) => Promise<void>
 */
export function withPubSubHandler<TPayload = unknown>(
  handler: ConverterHandler<TPayload>,
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    console.log('Received request', req.body);
    const { body } = req;
    if (!body) {
      pubsubError('no request body', res);
      return;
    }
    const { message } = body;
    if (!message) {
      pubsubError('no request message', res);
      return;
    }
    const { attributes, data } = message;
    if (!data) {
      pubsubError('no message data', res);
      return;
    }
    if (!attributes) {
      pubsubError('no message attributes', res);
      return;
    }

    let taskId: string | undefined;
    let client: SCMSJobClient | undefined;
    const attrs = attributes as Record<string, string>;

    for (const key of REQUIRED_ATTRS) {
      if (!attrs[key]) {
        pubsubError(`${key} is required`, res);
        return;
      }
    }

    const validatedAttributes = attrs as Attributes;
    console.log('Creating temporary folder');
    const tmpFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'scms-job'));
    console.log('Temporary folder created', tmpFolder);

    try {
      console.log('Received data', JSON.stringify(data, null, 2));
      console.log('Received attributes', JSON.stringify(attributes, null, 2));

      const dataDecoded = Buffer.from(data, 'base64').toString('utf-8');
      console.log('Decoded data', dataDecoded);

      let payload: TPayload;
      try {
        payload = JSON.parse(dataDecoded) as TPayload;
      } catch {
        pubsubError('message data is not valid JSON', res);
        return;
      }

      const { jobUrl, statusUrl, handshake } = validatedAttributes;
      client = new SCMSJobClient(jobUrl, statusUrl, handshake);
      await client.running(res, 'Starting converter job...');

      // Optional: extract taskId for logging and error reporting
      const withTaskId = payload as { taskId?: string };
      if (withTaskId?.taskId) {
        taskId = withTaskId.taskId;
        console.log('Task ID', taskId);
      }

      const ctx: HandlerContext<TPayload> = {
        client,
        attributes: validatedAttributes,
        payload,
        tmpFolder,
        res,
      };

      await handler(ctx);

      removeFolder(tmpFolder);
      console.log('Removed temporary folder');
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error('Error processing converter job:', err);
      removeFolder(tmpFolder);
      try {
        if (client) {
          const { failureState, userId } = validatedAttributes;
          await client.putSubmissionStatus(failureState, userId, res);
          await client.failed(res, `Converter failed: ${errMessage}`, {
            error: errMessage,
            taskId,
          });
        } else {
          pubsubError('Unable to process converter job', res);
        }
      } catch {
        // Response may already be sent; ignore secondary errors
      }
    }
  };
}
