/**
 * Shared utilities for handlers that produce a single PDF output.
 * Upload to CDN and update work version metadata (when cdn/cdn_key present).
 */

import fs from 'node:fs/promises';
import type { SCMSClient } from '@curvenote/scms-tasks';
import type {
  WorkVersionPayload,
  WorkVersionMetadataPayload,
  FileMetadataSectionItem,
} from '../payload.js';

const EXPORT_SLOT = 'export';
const PDF_MIME = 'application/pdf';

/**
 * When workVersion has cdn and cdn_key: uploads the local PDF to CDN and updates work version
 * metadata with the new file entry. Otherwise returns the local path unchanged.
 *
 * @returns The export path to report (CDN path if uploaded, otherwise local pdfPath).
 */
export async function uploadPdfAndUpdateWorkVersion(
  client: SCMSClient,
  workVersion: WorkVersionPayload,
  pdfPath: string,
  exportFilename: string,
): Promise<string> {
  if (!workVersion.cdn?.trim() || !workVersion.cdn_key?.trim()) {
    return pdfPath;
  }

  const stats = await fs.stat(pdfPath);
  const uploadResult = await client.uploads.uploadSingleFileToCdn({
    cdn: workVersion.cdn,
    cdnKey: workVersion.cdn_key,
    localPath: pdfPath,
    storagePath: `export/${exportFilename}`,
  });

  const pdfFileEntry: FileMetadataSectionItem = {
    name: exportFilename,
    size: stats.size,
    type: PDF_MIME,
    path: uploadResult.path,
    md5: '',
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

  await client.works.updateWorkVersionMetadata(workVersion.work_id, workVersion.id, metadata);

  return uploadResult.path;
}
