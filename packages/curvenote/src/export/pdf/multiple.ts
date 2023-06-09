import path from 'node:path';
import type { Project } from '../../models.js';
import type { ISession } from '../../session/types.js';
import { multipleArticleToTex } from '../tex/index.js';
import type { ExportConfig } from '../types.js';
import { createPdfGivenTexFile } from './create.js';

export async function multipleArticleToPdf(
  session: ISession,
  project: Project,
  job: ExportConfig,
  configPath: string,
) {
  await multipleArticleToTex(session, project, job, configPath, {
    useBuildFolder: true,
    texIsIntermediate: true,
  });
  const filename = path.join(configPath, job.folder, job.filename ?? 'main.tex');
  await createPdfGivenTexFile(session.log, filename);
}
