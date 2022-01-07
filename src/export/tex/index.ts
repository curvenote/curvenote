import fs from 'fs';
import util from 'util';
import child_process from 'child_process';
import { Blocks, VersionId, KINDS, oxaLink, convertToBlockId } from '@curvenote/blocks';
import { toTex } from '@curvenote/schema';
import os from 'os';
import path from 'path';
import { sync as which } from 'which';
import YAML from 'yaml';
import { Block, ExportTemplate, Version } from '../../models';
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

const exec = util.promisify(child_process.exec);

export function createTempFolder() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'curvenote'));
}

function throwIfTemplateButNoJtex(opts: Options) {
  if (opts.template && !which('jtex', { nothrow: true })) {
    throw new Error(
      'A template option was specified but the `jtex` command was not found on the path.',
    );
  }
}

async function fetchTemplate(session: Session, opts: Options): Promise<{ tagged: string[] }> {
  let tagged: string[] = [];
  if (opts.template) {
    session.$logger.debug(`Fetching Template Spec for ${opts.template}`);
    const template = await new ExportTemplate(session, opts.template).get();
    tagged = template.data.config.tagged.map((t) => t.id);
    session.$logger.debug(
      `Template '${opts.template}' supports following tagged content: ${tagged.join(', ')}`,
    );
  }
  return { tagged };
}

function loadTemplateOptions(opts: Options): Record<string, any> {
  if (opts.options) {
    if (!fs.existsSync(opts.options)) {
      throw new Error(`The template options file specified was not found: ${opts.options}`);
    }
    // TODO validate against the options schema here
    return YAML.parse(fs.readFileSync(opts.options as string, 'utf8')) as Record<string, any>;
  }
  return {};
}

type Options = {
  filename: string;
  images?: string;
  template?: string;
  options?: string;
};

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

function writeLocalizedContentToFile(
  children: ArticleStateChild[],
  mapperFn: (child: ArticleStateChild) => string,
  filename: string,
) {
  const content = children.map(mapperFn);
  const file = content.join('\n\n');
  fs.writeFileSync(filename, file);
}

export async function articleToTex(session: Session, versionId: VersionId, opts: Options) {
  throwIfTemplateButNoJtex(opts);
  const { tagged } = await fetchTemplate(session, opts);
  const optionData = loadTemplateOptions(opts);

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
  writeLocalizedContentToFile(
    article.children,
    (child) => convertAndLocalizeChild(session, child, imageFilenames, article.references),
    opts.filename,
  );

  const taggedFilenames: Record<string, string> = Object.entries(article.tagged)
    .map(([tag, children]) => {
      const filename = `${tag}.tex`;
      session.$logger.debug(
        `Writing tagged content from ${children.length} block(s) to ${filename}`,
      );
      writeLocalizedContentToFile(
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
    optionData,
  );
  writeDocumentToFile(model);

  // Write out the references
  await writeBibtex(article.references);

  return article;
}

export const oxaLinkToTex = exportFromOxaLink(articleToTex);
