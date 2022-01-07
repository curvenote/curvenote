import fs from 'fs';
import util from 'util';
import child_process from 'child_process';
import { Blocks, VersionId, KINDS, oxaLink, convertToBlockId } from '@curvenote/blocks';
import { toTex } from '@curvenote/schema';
import os from 'os';
import path from 'path';
import { Block, Version } from '../../models';
import { Session } from '../../session';
import { getChildren } from '../../actions/getChildren';
import { localizationOptions } from '../utils/localizationOptions';
import { writeBibtex } from '../utils/writeBibtex';
import {
  ArticleStateChild,
  ArticleStateReference,
  buildDocumentModel,
  exportFromOxaLink,
  walkArticle,
  writeDocumentToFile,
  writeImagesToFiles,
} from '../utils';
import { TexExportOptions } from './types';
import {
  fetchTemplateTaggedBlocks,
  loadTemplateOptions,
  throwIfTemplateButNoJtex,
} from './template';

const exec = util.promisify(child_process.exec);

export function createTempFolder() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'curvenote'));
}

function convertAndLocalizeChild(
  session: Session,
  child: ArticleStateChild,
  imageFilenames: Record<string, string>,
  references: Record<string, ArticleStateReference>,
) {
  if (!child.version || !child.state) return '';
  const sep = oxaLink(session.SITE_URL, child.version.id);

  const localization = localizationOptions(session, imageFilenames, references);
  const tex = toTex(child.state.doc, localization);
  return `%% ${sep}\n\n${tex}`;
}

function writeBlocksToFile(
  children: ArticleStateChild[],
  mapperFn: (child: ArticleStateChild) => string,
  filename: string,
) {
  const content = children.map(mapperFn);
  const file = content.join('\n\n');
  fs.writeFileSync(filename, `${file}\n`);
}

export async function articleToTex(session: Session, versionId: VersionId, opts: TexExportOptions) {
  throwIfTemplateButNoJtex(opts);
  const { tagged } = await fetchTemplateTaggedBlocks(session, opts);
  const templateOptions = loadTemplateOptions(opts);

  const [block, version] = await Promise.all([
    new Block(session, convertToBlockId(versionId)).get(),
    new Version(session, versionId).get(),
    getChildren(session, versionId),
  ]);
  const { data } = version;
  if (data.kind !== KINDS.Article) throw new Error('Not an article');

  const article = await walkArticle(session, data, tagged);

  const imageFilenames = await writeImagesToFiles(article.images, opts?.images ?? 'images');

  session.$logger.debug(`Writing main body of content to ${opts.filename}`);
  writeBlocksToFile(
    article.children,
    (child) => convertAndLocalizeChild(session, child, imageFilenames, article.references),
    opts.filename,
  );

  const taggedFilenames: Record<string, string> = Object.entries(article.tagged)
    .filter(([tag, children]) => {
      if (children.length === 0) {
        session.$logger.debug(`No tagged content found for "${tag}".`);
        return false;
      }
      return true;
    })
    .map(([tag, children]) => {
      const filename = `${tag}.tex`;
      session.$logger.debug(`Writing ${children.length} tagged block(s) to ${filename}`);
      writeBlocksToFile(
        children,
        (child) => convertAndLocalizeChild(session, child, imageFilenames, article.references),
        filename,
      );
      return { tag, filename };
    })
    .reduce((obj, { tag, filename }) => ({ ...obj, [tag]: filename }), {});

  const model = await buildDocumentModel(
    session,
    block,
    version as Version<Blocks.Article>,
    taggedFilenames,
    templateOptions,
  );
  writeDocumentToFile(model);

  // Write out the references
  await writeBibtex(article.references);

  return article;
}

export const oxaLinkToTex = exportFromOxaLink(articleToTex);
