import type { Context } from '../../../context.server.js';
import type { CreateJob } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { httpError, KnownJobTypes, coerceToObject } from '@curvenote/scms-core';
import type {
  ConverterPayload,
  WorkVersionPayload,
  WorkVersionMetadataPayload,
} from '@curvenote/common';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../../prisma.server.js';
import { createHandshakeToken } from '../../../sign.handshake.server.js';
import { publishConverterMessage } from '../../../processing.server.js';
import { signFilesInMetadata } from '../../../files-metadata.server.js';
import { dbCreateJob, dbUpdateJob } from './db.server.js';
import { validate } from '../../../../api.schemas.js';
import { CreateExportToPdfJobPayloadSchema } from './schemas.server.js';

const rollingLogEntry = (message: string, data: unknown) => ({ message, data });

/** Normalize to ISO string (data layer may give Date; we always want string in the payload). */
function isoString(value: string | Date | null): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : (value as Date).toISOString();
}

/**
 * Map workVersion row to task-converter WorkVersionPayload (snake_case).
 * Dates are normalized to ISO strings so the payload always has string dates.
 */
function workVersionToPayload(row: {
  id: string;
  work_id: string;
  date_created: string | Date;
  date_modified: string | Date;
  draft: boolean;
  cdn: string | null;
  cdn_key: string | null;
  title: string;
  description: string | null;
  authors: unknown;
  author_details: unknown;
  date: string | Date | null;
  doi: string | null;
  canonical: boolean | null;
  metadata: unknown;
  occ: number;
}): WorkVersionPayload {
  const metadata = row.metadata != null ? coerceToObject(row.metadata) : null;
  if (!metadata || typeof metadata !== 'object') {
    throw httpError(
      422,
      `Work version ${row.id} has no metadata; converter requires metadata.files`,
    );
  }
  const authors = Array.isArray(row.authors) ? row.authors : [];
  const authorDetails = Array.isArray(row.author_details) ? row.author_details : [];
  return {
    id: row.id,
    work_id: row.work_id,
    date_created: isoString(row.date_created) ?? '',
    date_modified: isoString(row.date_modified) ?? '',
    draft: row.draft,
    cdn: row.cdn,
    cdn_key: row.cdn_key,
    title: row.title,
    description: row.description,
    authors: authors as string[],
    author_details: authorDetails,
    date: isoString(row.date),
    doi: row.doi,
    canonical: row.canonical,
    metadata: metadata as WorkVersionMetadataPayload,
    occ: row.occ,
  };
}

/**
 * Export-to-PDF job handler (async pattern).
 *
 * 1. Validates payload; loads work version (if not found, returns error without creating job).
 * 2. Creates job in DB (QUEUED).
 * 3. Builds converter payload (snake_case workVersion) and publishes to converter Pub/Sub.
 * 4. Updates job with rollingLog and messageId; returns job DBO.
 * Worker later PATCHes the job (status/results) using the handshake token.
 */
export async function exportToPdfHandler(ctx: Context, data: CreateJob) {
  const rollingLog: { message: string; data: unknown }[] = [];

  const payload = validate(CreateExportToPdfJobPayloadSchema, data.payload);
  rollingLog.push(
    rollingLogEntry('payload validated', { work_version_id: payload.work_version_id }),
  );

  const prisma = await getPrismaClient();
  const workVersionRow = await prisma.workVersion.findUnique({
    where: { id: payload.work_version_id },
  });
  if (!workVersionRow) {
    throw httpError(404, `Work version ${payload.work_version_id} not found`);
  }
  rollingLog.push(rollingLogEntry('work version loaded', workVersionRow.id));

  const job = await dbCreateJob({ ...data, status: JobStatus.QUEUED });
  rollingLog.push(rollingLogEntry('job created', job.id));

  await prisma.linkedJob.create({
    data: {
      id: uuidv7(),
      date_created: job.date_created,
      job_id: job.id,
      work_version_id: payload.work_version_id,
    },
  });

  const workVersionPayload = workVersionToPayload(workVersionRow);
  if (workVersionPayload.metadata) {
    const signedMetadata = await signFilesInMetadata(
      workVersionPayload.metadata as Parameters<typeof signFilesInMetadata>[0],
      workVersionRow.cdn ?? '',
      ctx,
    );
    workVersionPayload.metadata = signedMetadata as WorkVersionMetadataPayload;
  }

  const converterPayload: ConverterPayload = {
    taskId: job.id,
    target: 'pdf',
    conversionType: payload.conversion_type,
    workVersion: workVersionPayload,
  };
  rollingLog.push(rollingLogEntry('converter payload built', { taskId: job.id }));

  const handshake = createHandshakeToken(
    job.id,
    KnownJobTypes.EXPORT_TO_PDF,
    ctx.$config.api.handshakeIssuer,
    ctx.$config.api.handshakeSigningSecret,
  );
  const jobUrl = ctx.asApiUrl(`/jobs/${job.id}`);
  if (!ctx.user?.id) {
    throw httpError(401, 'Export job requires an authenticated user');
  }
  const attributes = {
    handshake,
    jobUrl,
    userId: ctx.user.id,
  };

  const messageId = await publishConverterMessage(
    attributes,
    converterPayload as Record<string, unknown>,
  );
  rollingLog.push(rollingLogEntry('Message published to Pub/Sub', { messageId }));

  const updated = await dbUpdateJob(job.id, {
    status: JobStatus.RUNNING,
    message: 'Export-to-PDF message published to converter',
    results: {
      rollingLog,
      pubsubMessageId: messageId,
    },
  });
  return updated;
}
