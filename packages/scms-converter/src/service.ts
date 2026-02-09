/**
 * SCMS Converter Service
 *
 * Node.js server for the SCMS converter (Cloud Run style). Validates incoming
 * POST payload and message attributes, creates a temp folder, then runs
 * converter implementation with consistent error handling and cleanup.
 */

import express from 'express';
import type { HandlerContext } from '@curvenote/scms-tasks';
import { withPubSubHandler } from '@curvenote/scms-tasks';

/** Payload shape for the converter (extend with task-specific fields as needed). */
type ConverterPayload = { taskId?: string };

/**
 * Creates and configures the Express service for the SCMS converter.
 *
 * @returns Express application instance
 */
export function createService() {
  const app = express();
  app.use(express.json());

  app.get('/', async (_, res) => {
    console.log('Received GET request');
    return res.send('Curvenote SCMS Converter Service');
  });

  /**
   * Main endpoint for converter jobs.
   *
   * Uses withPubSubHandler to validate request/message/attributes/data, create
   * temp folder and job client, decode JSON payload, then run the converter.
   * Your handler receives (client, attributes, payload, tmpFolder); get taskId
   * or other task-specific info from attributes or payload as needed.
   */
  app.post(
    '/',
    withPubSubHandler<ConverterPayload>(
      async (ctx: HandlerContext<ConverterPayload>) => {
        const { client, attributes, payload, tmpFolder, res } = ctx;
        // Handler receives (client, attributes, payload, tmpFolder, res). Get taskId from payload/attributes.
        const taskId = payload.taskId;
        if (taskId) console.log('Task ID from payload', taskId);
        console.log('In handler');

        // Placeholder: add real conversion logic here.

        await client.completed(res, 'Converter completed (placeholder)', { taskId });
      },
      { clientLoggingOnlyMode: true },
    ),
  );

  return app;
}
