import type { VersionId } from '@curvenote/blocks';
import type { ISession } from '../../session/types';
import { writeBibtex } from '../utils/writeBibtex';
import { makeBuildPaths } from '../utils';
import { gatherAndWriteArticleContent } from './gather';
import {
  ifTemplateFetchTaggedBlocks,
  ifTemplateLoadOptions,
  throwIfTemplateButNoJtex,
} from './template';
import type { TexExportOptions } from './types';
import { ifTemplateRunJtex } from './utils';

export async function singleArticleToTex(
  session: ISession,
  versionId: VersionId,
  opts: TexExportOptions,
) {
  throwIfTemplateButNoJtex(opts);
  const { tagged } = await ifTemplateFetchTaggedBlocks(session, opts);
  const templateOptions = ifTemplateLoadOptions(opts);

  const { buildPath } = makeBuildPaths(session.log, opts);

  session.log.debug('Starting articleToTex...');
  session.log.debug(`With Options: ${JSON.stringify(opts)}`);

  const { article, filename } = await gatherAndWriteArticleContent(
    session,
    versionId,
    opts,
    tagged,
    templateOptions,
    buildPath,
  );

  session.log.debug('Writing bib file...');
  await writeBibtex(session, article.references, 'main.bib', {
    path: buildPath,
    alwaysWriteFile: true,
  });

  await ifTemplateRunJtex(filename, session.log, opts);

  return article;
}
