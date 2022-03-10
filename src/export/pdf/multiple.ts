import path from 'path';
import { multipleArticleToTex } from '../tex';
import { ExportConfig } from '../../config/types';
import { Project } from '../../models';
import { ISession } from '../../session/types';
import { createPdfGivenTexFile } from './create';

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
