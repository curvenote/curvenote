import fs from 'fs';
import util from 'util';
import child_process from 'child_process';
import { VersionId, KINDS, oxaLink, oxaLinkToId, convertToBlockId } from '@curvenote/blocks';
import { toTex } from '@curvenote/schema';
import os from 'os';
import path from 'path';
import { Article } from '@curvenote/blocks/dist/blocks/article';
import { sync as which } from 'which';
import { Block, Version } from '../../models';
import { Session } from '../../session';
import { getChildren } from '../../actions/getChildren';
import { localizationOptions } from '../utils/localizationOptions';
import { writeBibtex } from '../utils/writeBibtex';
import {
  buildDocumentModel,
  exportFromOxaLink,
  walkArticle,
  writeDocumentToFile,
  writeImagesToFiles,
} from '../utils';

const exec = util.promisify(child_process.exec);

export function createTempFolder() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'curvenote'));
}

function throwIfTemplateButNoJtex(session: Session, opts: Options) {
  if (opts.template && !which('jtex', { nothrow: true })) {
    throw new Error(
      'A template option was specified but the `jtex` command was not found on the path.',
    );
  }
}

type Options = {
  filename: string;
  images?: string;
  template?: string;
};

export async function articleToTex(session: Session, versionId: VersionId, opts: Options) {
  throwIfTemplateButNoJtex(session, opts);

  const [block, version] = await Promise.all([
    new Block(session, convertToBlockId(versionId)).get(),
    new Version(session, versionId).get(),
    getChildren(session, versionId),
  ]);

  const { data } = version;
  if (data.kind !== KINDS.Article) throw new Error('Not an article');
  const article = await walkArticle(session, data);

  const imageFilenames = await writeImagesToFiles(article.images, opts?.images ?? 'images');

  const model = await buildDocumentModel(session, block, version as Version<Article>);
  writeDocumentToFile(model);

  const localization = localizationOptions(session, imageFilenames, article);
  const content = article.children.map((child) => {
    if (!child.version || !child.state) return '';
    const sep = oxaLink(session.SITE_URL, child.version.id);
    const tex = toTex(child.state.doc, localization);
    return `%% ${sep}\n\n${tex}`;
  });
  const file = content.join('\n\n');
  fs.writeFileSync(opts.filename, file);

  // Write out the references
  await writeBibtex(article.references);

  return article;
}

export const oxaLinkToTex = exportFromOxaLink(articleToTex);
