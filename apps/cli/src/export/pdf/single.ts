import path from 'path';
import type { VersionId } from '@curvenote/blocks';
import type { ISession } from '../../session/types';
import { singleArticleToTex } from '../tex';
import type { TexExportOptions } from '../tex/types';
import { createPdfGivenTexFile } from './create';

export async function singleArticleToPdf(
  session: ISession,
  versionId: VersionId,
  opts: TexExportOptions,
) {
  const outputPath = path.dirname(opts.filename);
  const basename = path.basename(opts.filename, path.extname(opts.filename));
  const tex_filename = `${basename}.tex`;
  const targetTexFilename = path.join(outputPath, tex_filename);

  const article = await singleArticleToTex(session, versionId, {
    ...opts,
    filename: targetTexFilename,
    template: opts.template ?? 'public/default',
    useBuildFolder: true,
    texIsIntermediate: true,
  });

  // TODO: jtex currently downloads the template for use, but we pre-load the template configuration file/spec in
  // ifTemplateFetchTaggedBlocks() called in singleArticleToTex. If we can do that prefetch earlier, then we could
  // test for a flag in the template.yml schema, and set the opts.command here to xelatex or pdflatex appropriately
  await createPdfGivenTexFile(session.log, targetTexFilename, opts.command);

  return article;
}
