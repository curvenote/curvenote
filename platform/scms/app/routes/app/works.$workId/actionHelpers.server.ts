import { data } from 'react-router';
import {
  userHasScope,
  jobs,
  getPrismaClient,
  registerExtensionJobs,
} from '@curvenote/scms-server';
import type { WorkContext } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { uuidv7 } from 'uuidv7';
import { extensions } from '../../../extensions/server';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const ExportToPdfActionSchema = zfd.formData({
  intent: zfd.text(z.literal('export-to-pdf')),
  workVersionId: zfd.text(z.string().uuid()),
});

function hasDocxInMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as Array<{ type?: string; name?: string; path?: string }>;
  return entries.some(
    (f) =>
      f?.type === DOCX_MIME ||
      (typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.docx')) ||
      (typeof f?.path === 'string' && f.path.toLowerCase().endsWith('.docx')),
  );
}

export async function exportToPdfAction(ctx: WorkContext, formData: FormData) {
  const parsed = ExportToPdfActionSchema.safeParse(formData);
  if (!parsed.success) {
    return data(
      { error: { type: 'general' as const, message: 'Invalid form data' } },
      { status: 400 },
    );
  }

  const { workVersionId } = parsed.data;

  if (!userHasScope(ctx.user, scopes.app.works.export)) {
    return data(
      {
        error: {
          type: 'general' as const,
          message: 'You do not have permission to export to PDF.',
        },
      },
      { status: 403 },
    );
  }

  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
  });

  if (!workVersion || workVersion.work_id !== ctx.work.id) {
    return data(
      { error: { type: 'general' as const, message: 'Work version not found.' } },
      { status: 404 },
    );
  }

  if (!hasDocxInMetadata(workVersion.metadata)) {
    return data(
      { error: { type: 'general' as const, message: 'No Word document found in this version.' } },
      { status: 400 },
    );
  }

  try {
    const dto = await jobs.invoke(
      ctx,
      {
        id: uuidv7(),
        job_type: 'EXPORT_TO_PDF',
        payload: {
          work_version_id: workVersionId,
          target: 'pdf',
          conversion_type: 'docx-pandoc-myst-pdf',
        },
        results: undefined,
        invoked_by_id: ctx.user?.id,
      },
      registerExtensionJobs(extensions),
    );
    return data({ success: true, jobId: dto.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export to PDF failed.';
    return data({ error: { type: 'general' as const, message } }, { status: 500 });
  }
}
