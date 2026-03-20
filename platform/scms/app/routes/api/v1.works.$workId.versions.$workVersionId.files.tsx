import type { Route } from './+types/v1.works.$workId.versions.$workVersionId.files';
import { z } from 'zod';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  getPrismaClient,
  safeWorkVersionJsonUpdate,
  makeDefaultWorkVersionMetadata,
} from '@curvenote/scms-server';
import {
  error401,
  error404,
  error405,
  httpError,
  coerceToObject,
  FileMetadataSectionItemSchema,
  type FileMetadataSection,
} from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';

/** PATCH body for adding a single file entry to work version metadata.files (no signedUrl). */
const AddWorkVersionFilePatchBodySchema = FileMetadataSectionItemSchema.omit({
  signedUrl: true,
});

/** PATCH body for adding file entries: { files: FileEntry[] }. */
const AddWorkVersionFilesPatchBodySchema = z.object({
  files: z.array(AddWorkVersionFilePatchBodySchema).min(1),
});

export async function loader() {
  throw error405();
}

/**
 * PATCH /v1/works/:workId/versions/:workVersionId/files
 *
 * Add one or more file entries to work version metadata.files.
 * Body: { files: FileEntry[] }.
 * Requires handshake; jobId in handshake must be linked to this work version
 * via LinkedJob and the job status must be QUEUED or RUNNING.
 * Uses OCC to update metadata safely.
 * Returns minimal payload: id and the added metadata.files entries.
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);
  if (args.request.method !== 'PATCH') throw error404();

  if (!ctx.authorized.handshake) throw error401();
  const handshakeJobId = ctx.$handshakeClaims?.jobId;
  if (!handshakeJobId) throw error401();

  const { workId, workVersionId } = args.params;
  if (!workId) throw httpError(400, 'workId is required');
  if (!workVersionId) throw httpError(400, 'workVersionId is required');

  const prisma = await getPrismaClient();

  // Ensure work version exists and belongs to this work
  const workVersion = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
    select: { id: true, work_id: true },
  });
  if (!workVersion) throw httpError(404, 'work version not found');
  if (workVersion.work_id !== workId) throw httpError(404, 'work version not found');

  // Security: handshake jobId must be in LinkedJobs for this workVersionId and job must be QUEUED or RUNNING
  const linked = await prisma.linkedJob.findFirst({
    where: { work_version_id: workVersionId, job_id: handshakeJobId },
    include: { job: { select: { id: true, status: true } } },
  });
  if (!linked) throw httpError(403, 'job not linked to this work version');
  if (linked.job.status !== JobStatus.QUEUED && linked.job.status !== JobStatus.RUNNING) {
    throw httpError(403, 'job must be QUEUED or RUNNING to add files');
  }

  const body = await ensureJsonBodyFromMethod(args.request, ['PATCH']);
  const { files: fileEntries } = validate(AddWorkVersionFilesPatchBodySchema, body);

  const updated = await safeWorkVersionJsonUpdate<FileMetadataSection>(
    workVersionId,
    (metadata) => {
      const readMetadata = coerceToObject(metadata);
      const updatedMetadata: FileMetadataSection = {
        ...makeDefaultWorkVersionMetadata(),
        ...readMetadata,
        files: {
          ...(readMetadata?.files && typeof readMetadata.files === 'object'
            ? readMetadata.files
            : {}),
        },
      };

      for (const fileEntry of fileEntries) {
        const path = fileEntry.path;
        if (updatedMetadata.files[path]) {
          throw httpError(409, `file already exists at path: ${path}`);
        }
        const existingFilesInSlot = Object.values(updatedMetadata.files).filter(
          (f: { slot?: string }) => f.slot === fileEntry.slot,
        );
        const maxOrder =
          existingFilesInSlot.length > 0
            ? Math.max(...existingFilesInSlot.map((f: { order?: number }) => f.order ?? 0))
            : 0;
        const order = fileEntry.order ?? maxOrder + 1;
        updatedMetadata.files[path] = { ...fileEntry, order };
      }
      return updatedMetadata;
    },
  );

  const files = (updated.metadata as FileMetadataSection | null)?.files;
  const added: Record<string, unknown> = {};
  for (const fileEntry of fileEntries) {
    const entry = files && typeof files === 'object' ? files[fileEntry.path] : undefined;
    if (entry) added[fileEntry.path] = entry;
  }

  return Response.json(
    {
      id: workVersionId,
      files: added,
    },
    { status: 200 },
  );
}
