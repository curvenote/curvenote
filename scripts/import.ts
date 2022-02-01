import { getSession } from '../src/cli/services/utils';
import fs from 'fs';
import YAML from 'yaml';
import path from 'path';
import { Block, Version } from '../src';
import { BlockChildDict, ContentFormatTypes, KINDS } from '@curvenote/blocks';
import { nanoid } from 'nanoid';

// const IMPORT_PATH = '../../ejssoil';
// const MD_FILE = '../../ejssoil/main.md';
// const BIBTEX_FILE = '../../ejssoil/main.bib';

const IMPORT_PATH = '../../jscli_test/geo';
const MD_FILE = 'article.md';
const BIBTEX_FILE = 'main.bib';

const PROJECT_ID = 'ein6KOb0JUzJzDSPW63b';

async function main() {
  const session = getSession();
  console.log('Got session', session.API_URL);

  const md_file = path.join(__dirname, IMPORT_PATH, MD_FILE);
  console.log('Loading:', md_file);
  const md = fs.readFileSync(md_file, { encoding: 'utf-8' });

  const [_, frontMatter, content] = md.split('---');

  // upload content blocks
  const contentBlocks = content.split('+++');
  console.log(`Found ${contentBlocks.length} content blocks`);

  const order: string[] = [];
  const children: BlockChildDict = {};
  for (let cblock of contentBlocks) {
    try {
      const blockId = await Block.create(session, PROJECT_ID, { kind: KINDS.Content });
      console.log('created block', blockId.block);

      const versionId = await Version.create(session, blockId, {
        format: ContentFormatTypes.md,
        content: cblock,
      });
      console.log('created version', versionId.version);

      const childId = nanoid();
      order.push(childId);
      children[childId] = {
        id: childId,
        src: { ...versionId, draft: null },
        style: null,
      };
    } catch (err) {
      console.error('Could not create block/version');
      console.error(`Error ${err}`);
      console.error('*** CONTENT ***');
      console.error(cblock);
      console.error('*** SKIPPED ***');
    }
  }

  // create article blocks
  const fm = YAML.parse(frontMatter);

  let authors;
  if (fm.authors) {
    // TODO if author name starts with @ do a username lookup
    authors = fm.authors.map((author: string) => {
      plain: author;
    });
  }

  const articleBlockData = {
    kind: KINDS.Article,
    title: fm.title ?? undefined,
    description: fm.description ?? undefined,
    authors,
  };

  const articleBlockId = await Block.create(session, PROJECT_ID, articleBlockData);
  console.log('created Article block', articleBlockId.block);

  const articleVersionData = { order, children };

  const articleVersionId = await Version.create(session, articleBlockId, articleVersionData);
  console.log('created Article version', articleVersionId.block);
}

main();
