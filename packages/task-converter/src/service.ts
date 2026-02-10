/**
 * SCMS Converter Service
 *
 * Node.js server for the SCMS converter (Cloud Run style). Validates incoming
 * POST payload (target, conversionType, workVersion, optional filename), runs
 * Word → PDF via pandoc-myst pipeline, then uploads PDF and updates work version
 * metadata via the SCMS client (when workVersion has cdn/cdn_key).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { HandlerContext } from '@curvenote/scms-tasks';
import { withPubSubHandler } from '@curvenote/scms-tasks';
import {
  validatePayload,
  type ConverterPayload,
  type WorkVersionMetadataPayload,
  type FileMetadataSectionItem,
} from './payload.js';
import { runPandocMystPipeline } from './convert.js';

const EXPORT_SLOT = 'export';
const PDF_MIME = 'application/pdf';
const DEFAULT_EXPORT_FILENAME = 'document.pdf';

function exportFilenameFromPayload(filename?: string): string {
  if (!filename || typeof filename !== 'string') return DEFAULT_EXPORT_FILENAME;
  const base = path.basename(filename);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

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
   * Validates payload (target === 'pdf', conversionType === 'pandoc-myst', workVersion).
   * Export filename comes from payload.filename, default 'document.pdf'.
   * Runs: pick Word → download → pandoc → write curvenote.yml + index.md front matter
   * → curvenote build --pdf → upload PDF and update work version metadata (via SCMS client) → completed.
   */
  app.post(
    '/',
    withPubSubHandler<ConverterPayload>(
      async (ctx: HandlerContext<ConverterPayload>) => {
        const { client, attributes, payload, tmpFolder, res } = ctx;

        if (!validatePayload(payload)) {
          throw new Error(
            'Invalid payload: required workVersion (object with id, work_id, title, authors), target = "pdf", conversionType = "pandoc-myst", and metadata as object',
          );
        }

        const workVersion = payload.workVersion;
        const taskId = payload.taskId;
        const exportFilename = exportFilenameFromPayload(payload.filename);
        if (taskId) console.log('Task ID from payload', taskId);

        const pdfPath = await runPandocMystPipeline(workVersion, tmpFolder, exportFilename);
        const stats = await fs.stat(pdfPath);
        let exportPath: string = pdfPath;

        // Upload and update work version via SCMS client (when cdn/cdn_key present)
        if (workVersion.cdn?.trim() && workVersion.cdn_key?.trim()) {
          const uploadResult = await client.uploads.uploadSingleFileToCdn({
            cdn: workVersion.cdn,
            cdnKey: workVersion.cdn_key,
            localPath: pdfPath,
            storagePath: `export/${exportFilename}`,
          });
          exportPath = uploadResult.path;
          const pdfFileEntry: FileMetadataSectionItem = {
            name: exportFilename,
            size: stats.size,
            type: PDF_MIME,
            path: uploadResult.path,
            md5: '', // upload API could be extended to return md5 if needed
            uploadDate: new Date().toISOString(),
            slot: EXPORT_SLOT,
          };
          const metadata: WorkVersionMetadataPayload = {
            ...workVersion.metadata,
            version: workVersion.metadata?.version ?? 1,
            files: {
              ...(workVersion.metadata?.files && typeof workVersion.metadata.files === 'object'
                ? workVersion.metadata.files
                : {}),
              [uploadResult.path]: pdfFileEntry,
            },
          };
          await client.works.updateWorkVersionMetadata(
            workVersion.work_id,
            workVersion.id,
            metadata,
          );
        }

        await client.jobs.completed(res, 'PDF conversion completed', {
          taskId,
          workVersionId: workVersion.id,
          workId: workVersion.work_id,
          exportPath,
        });
      },
      { clientLoggingOnlyMode: true, tmpFolderRoot: './tmp', preserveTmpFolder: true },
    ),
  );

  return app;
}
