/**
 * SCMS Converter Service
 *
 * Node.js server for the SCMS converter (Cloud Run style). Validates incoming
 * POST payload (target, conversionType, workVersion, optional filename), routes
 * to the appropriate HAT conversion handler (e.g. docx-pandoc-myst-pdf or
 * docx-lowriter-pdf), then uploads PDF and updates work version metadata via
 * Handlers produce the PDF, upload to CDN and update work version metadata (when cdn/cdn_key
 * present), and return the export path; the service then signals job completed.
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
   * Validates payload (target === 'pdf', conversionType in supported HAT handlers, workVersion).
   * Export filename comes from payload.filename, default 'document.pdf'.
   * Routes to the handler for the given conversionType. The handler produces the PDF,
   * uploads and updates work version metadata (when cdn/cdn_key present), and returns
   * the export path. Service then signals job completed.
   */
  app.post(
    '/',
    withPubSubHandler<ConverterPayload>(
      async (ctx: HandlerContext<ConverterPayload>) => {
        const { client, payload, res } = ctx;

        if (!validatePayload(payload)) {
          throw new Error(
            'Invalid payload: required workVersion (object with id, work_id, title, authors), target = "pdf", conversionType one of (docx-pandoc-myst-pdf, docx-lowriter-pdf), and metadata as object',
          );
        }

        const workVersion = payload.workVersion;
        const taskId = payload.taskId;
        if (taskId) console.log('Task ID from payload', taskId);

        const handler = getHandler(payload.conversionType);
        const exportPath = await handler(ctx);

        await client.jobs.completed(res, 'PDF conversion completed', {
          taskId,
          workVersionId: workVersion.id,
          workId: workVersion.work_id,
          exportPath,
        });
      },
      {
        clientLoggingOnlyMode: process.env.NODE_ENV === 'development' ? true : undefined,
        tmpFolderRoot: process.env.NODE_ENV === 'development' ? './tmp' : undefined,
        preserveTmpFolder: process.env.NODE_ENV === 'development' ? true : undefined,
      },
    ),
  );

  return app;
}
