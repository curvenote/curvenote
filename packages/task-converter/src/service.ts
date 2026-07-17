/**
 * SCMS Converter Service
 *
 * Node.js server for the SCMS converter (Cloud Run style). Validates incoming
 * POST payload (target, conversionType, workVersion, optional filename), routes
 * to the appropriate HAT conversion handler (e.g. docx-pandoc-myst-pdf,
 * docx-lowriter-pdf, or docx-pandoc-myst-web), then uploads outputs and updates
 * work version state. Handlers return an export/site path; the service signals
 * job completed.
 */

import express from 'express';
import type { HandlerContext } from '@curvenote/scms-tasks';
import { withPubSubHandler } from '@curvenote/scms-tasks';
import { validatePayload, type ConverterPayload } from './payload.js';
import { getHandler } from './handlers/index.js';

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
   * Validates payload (target pdf|web, conversionType in supported HAT handlers, workVersion).
   * Routes to the handler for the given conversionType. The handler produces the output,
   * uploads and updates work version state when configured, and returns the export/site path.
   * Service then signals job completed.
   */
  app.post(
    '/',
    withPubSubHandler<ConverterPayload>(
      async (ctx: HandlerContext<ConverterPayload>) => {
        const { client, payload, res } = ctx;

        if (!validatePayload(payload)) {
          throw new Error(
            'Invalid payload: required workVersion (object with id, work_id, title, authors), target matching conversionType (pdf|web), conversionType one of (docx-pandoc-myst-pdf, docx-lowriter-pdf, docx-pandoc-myst-web), and metadata as object',
          );
        }

        const workVersion = payload.workVersion;
        const taskId = payload.taskId;
        if (taskId) console.log('Task ID from payload', taskId);

        const handler = getHandler(payload.conversionType);
        const exportPath = await handler(ctx);

        const completedMessage =
          payload.target === 'web' ? 'MyST site conversion completed' : 'PDF conversion completed';
        await client.jobs.completed(res, completedMessage, {
          taskId,
          workVersionId: workVersion.id,
          workId: workVersion.work_id,
          exportPath,
          target: payload.target,
          conversionType: payload.conversionType,
        });
      },
      {
        clientLoggingOnlyMode: undefined,
        tmpFolderRoot: process.env.NODE_ENV === 'development' ? './tmp' : undefined,
        preserveTmpFolder: process.env.NODE_ENV === 'development' ? true : undefined,
      },
    ),
  );

  return app;
}
