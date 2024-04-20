import yaml from 'js-yaml';
import type { Blocks, VersionId } from '@curvenote/blocks';
import { KINDS } from '@curvenote/blocks';
import { prepareToWrite } from 'myst-cli';
import { writeFileToFolder } from 'myst-cli-utils';
import { fillPageFrontmatter } from 'myst-frontmatter';
import {
  pageFrontmatterFromDTOAndThumbnail,
  projectFrontmatterFromDTO,
  saveAffiliations,
} from '../../frontmatter/api.js';
import { Block, Project, Version } from '../../models.js';
import type { ISession } from '../../session/types.js';
import { resolvePath } from '../../utils/index.js';
import { remoteExportWrapper } from '../utils/remoteExportWrapper.js';
import { getChildren } from '../utils/getChildren.js';

export type NotebookExportOptions = {
  path?: string;
  filename: string;
  createNotebookFrontmatter?: boolean;
  ignoreProjectFrontmatter?: boolean;
};

async function createFrontmatterCell(
  session: ISession,
  filename: string,
  block: Block,
  opts: NotebookExportOptions,
) {
  const project = await new Project(session, block.id.project).get();
  saveAffiliations(session, project.data);
  let frontmatter = await pageFrontmatterFromDTOAndThumbnail(session, filename, block.data);
  const validationOpts = {
    property: 'frontmatter',
    file: opts.filename,
    messages: {},
    errorLogFn: (message: string) => {
      session.log.error(`Validation error: ${message}`);
    },
    warningLogFn: (message: string) => {
      session.log.warn(`Validation: ${message}`);
    },
  };
  if (!opts.ignoreProjectFrontmatter) {
    const projectFrontmatter = projectFrontmatterFromDTO(session, project.data);
    frontmatter = fillPageFrontmatter(frontmatter, projectFrontmatter, validationOpts);
  }
  return {
    cell_type: 'markdown',
    metadata: {
      frontmatter: true,
    },
    source: `---\n${yaml.dump(prepareToWrite(frontmatter)).trim()}\n---`,
  };
}

export async function notebookToIpynb(
  session: ISession,
  versionId: VersionId,
  opts: NotebookExportOptions,
) {
  if (!opts.filename.endsWith('.ipynb')) {
    throw new Error(`Filename must end with '.ipynb': "${opts.filename}"`);
  }
  const [block, version] = await Promise.all([
    new Block(session, versionId).get(),
    new Version<Blocks.Notebook>(session, versionId).get(),
    getChildren(session, versionId),
  ]);
  if (block.data.kind !== KINDS.Notebook) {
    throw new Error(`Cannot export block of kind "${block.data.kind}" as a Notebook.`);
  }
  // NOTE: this should be handled better in the client.
  const resp = await session.get(`${version.$createUrl()}/download`);
  if (!resp.ok) throw new Error(`Could not download notebook.`);
  if (opts.createNotebookFrontmatter) {
    // Put a frontmatter cell in the front!
    const frontmatterCell = await createFrontmatterCell(
      session,
      resolvePath(opts.path, opts.filename),
      block,
      opts,
    );
    resp.json.cells = [frontmatterCell, ...resp.json.cells];
  }
  writeFileToFolder(resolvePath(opts.path, opts.filename), JSON.stringify(resp.json));
}

export const oxaLinkToNotebook = remoteExportWrapper(notebookToIpynb);
