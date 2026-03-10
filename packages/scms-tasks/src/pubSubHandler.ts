/**
 * Pub/Sub handler wrapper for SCMS job handlers (e.g. converter).
 *
 * Validates request/message/attributes/data, creates temp folder and job client,
 * decodes the JSON payload, then invokes the provided handler with (client,
 * attributes, payload, tmpFolder, res). On success the handler is responsible
 * for client.submissions.putStatus and client.jobs.completed(); the wrapper only removes the temp
 * folder. On error the wrapper handles cleanup, optionally calls onFailure
 * (e.g. to update submission status), then failed().
 */

import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { removeFolder, pubsubError } from './utils.js';
import { getWorksApiBase } from './works.js';
import { SCMSClient } from './client.js';

/**
 * Message attributes structure expected from the pub/sub system.
 * jobUrl, handshake, and userId are required. statusUrl, successState, and failureState
 * are optional (e.g. for job-only flows with no submission status transition).
 */
export type Attributes = {
  jobUrl: string;
  handshake: string;
  userId: string;
  statusUrl?: string;
  successState?: string;
  failureState?: string;
};

const REQUIRED_ATTRS: (keyof Attributes)[] = ['jobUrl', 'handshake', 'userId'];

/**
 * Context passed to the converter handler: client, attributes, decoded payload, temp folder, and response (for progress updates).
 * client is SCMSClient (jobs, submissions, works, uploads); use client.completed/client.jobs, client.works, client.uploads, etc.
 */
export type HandlerContext<TPayload = unknown> = {
  client: SCMSClient;
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
 * On success the handler must call client.submissions.putStatus and client.jobs.completed(); then the wrapper removes the temp folder.
 * Throw on failure (wrapper handles cleanup, optional onFailure, then client.jobs.failed()).
 */
export type ConverterHandler<TPayload = unknown> = (
  ctx: HandlerContext<TPayload>,
) => Promise<HandlerSuccessResult | void>;

/**
 * Optional callback invoked on failure. Receives failureState, userId, and res
 * (and client when invoking) so the caller can e.g. update submission status.
 */
export type OnFailureCallback = (
  client: SCMSClient,
  failureState: string,
  userId: string,
  res: Response,
) => Promise<void>;

export type WithPubSubHandlerOptions = {
  onFailure?: OnFailureCallback;
  /** When true, SCMSClient job/submission calls skip HTTP and only log (for development). */
  clientLoggingOnlyMode?: boolean;
  tmpFolderRoot?: string;
  preserveTmpFolder?: boolean;
};

/**
 * Wraps the Pub/Sub POST boilerplate and calls the given handler with (client, attributes, payload, tmpFolder, res).
 *
 * - Validates body, message, attributes, data
 * - Creates temp folder, validates required attributes, decodes base64 data to JSON
 * - Creates SCMSClient and calls client.jobs.running()
 * - Invokes handler(ctx)
 * - On success: handler is responsible for client.submissions.putStatus and client.jobs.completed(); wrapper then removes folder
 * - On error: removes folder, calls onFailure(client, failureState, userId, res) when provided, then client.jobs.failed(res, ...)
 *
 * @param handler - Function that receives client, attributes, decoded payload, tmpFolder, and res
 * @param options - Optional; onFailure called on failure with (client, failureState, userId, res)
 * @returns Express request handler (req, res) => Promise<void>
 */
export function withPubSubHandler<TPayload = unknown>(
  handler: ConverterHandler<TPayload>,
  options?: WithPubSubHandlerOptions,
): (req: Request, res: Response) => Promise<void> {
  const { onFailure, clientLoggingOnlyMode, tmpFolderRoot, preserveTmpFolder } = options ?? {};

  console.log('withPubSubHandler options', options);
  console.log('env.NODE_ENV', process.env.NODE_ENV);

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
    let client: SCMSClient | undefined;
    const attrs = attributes as Record<string, string>;

    for (const key of REQUIRED_ATTRS) {
      if (!attrs[key]) {
        pubsubError(`${key} is required`, res);
        return;
      }
    }

    const validatedAttributes = attrs as Attributes;
    console.log('Creating temporary folder');
    const root = tmpFolderRoot ?? os.tmpdir();
    await fs.mkdir(root, { recursive: true });
    const tmpFolder = await fs.mkdtemp(path.join(root, 'scms-job'));
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
      const effectiveStatusUrl = statusUrl ?? jobUrl;
      const baseUrl = getWorksApiBase(validatedAttributes);
      client = new SCMSClient(jobUrl, effectiveStatusUrl, handshake, {
        baseUrl,
        loggingOnlyMode: clientLoggingOnlyMode ?? false,
      });
      await client.jobs.running(res, 'Starting converter job...');

      const ctx: HandlerContext<TPayload> = {
        client,
        attributes: validatedAttributes,
        payload,
        tmpFolder,
        res,
      };

      await handler(ctx);

      if (!preserveTmpFolder) {
        await removeFolder(tmpFolder);
      }
      console.log('Removed temporary folder');
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error('Error processing converter job:', err);
      if (!preserveTmpFolder) {
        await removeFolder(tmpFolder);
      }
      try {
        if (client) {
          const { failureState, userId } = validatedAttributes;
          if (onFailure && failureState != null && userId != null) {
            await onFailure(client, failureState, userId, res);
          }
          await client.jobs.failed(res, `Converter failed: ${errMessage}`, {
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
