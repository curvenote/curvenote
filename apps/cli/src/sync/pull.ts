import fs from 'fs';
import pLimit from 'p-limit';
import { join, dirname, basename, extname } from 'path';
import { projectFrontmatterFromDTO, saveAffiliations } from '../frontmatter/api';
import { loadConfigOrThrow, writeConfigs } from '../config';
import { oxaLinkToMarkdown, oxaLinkToNotebook, projectToJupyterBook } from '../export';
import { LogLevel, getLevel } from '../logging';
import { Project } from '../models';
import { ISession } from '../session/types';
import { selectors } from '../store';
import { config } from '../store/local';
import { isDirectory } from '../toc/utils';
import { confirmOrExit, tic } from '../utils';
import { projectLogString } from './utils';
import { getRawFrontmatterFromFile } from '../store/local/actions';

/**
 * Pull content for a project on a path
 *
 * Errors if project config does not exist or no remote project url is specified.
 */
export async function pullProject(session: ISession, path: string, opts?: { level?: LogLevel }) {
  const state = session.store.getState();
  const projectConfig = selectors.selectLocalProjectConfig(state, path);
  if (!projectConfig) throw Error(`Cannot pull project from ${path}: no project config`);
  if (!projectConfig.remote) throw Error(`Cannot pull project from ${path}: no remote project url`);
  const log = getLevel(session.log, opts?.level ?? LogLevel.debug);
  const project = await new Project(session, projectConfig.remote).get();
  saveAffiliations(session, project.data);
  const newFrontmatter = projectFrontmatterFromDTO(session, project.data);
  session.store.dispatch(
    config.actions.receiveProject({ path, ...projectConfig, ...newFrontmatter }),
  );
  writeConfigs(session, path);
  const toc = tic();
  log(`📥 Pulling ${projectLogString(project)} into ${path}`);
  await projectToJupyterBook(session, project.id, {
    path,
    writeConfig: false,
    createNotebookFrontmatter: true,
    titleOnlyInFrontmatter: true,
    keepOutputs: true,
    // Project frontmatter is kept sepatare in project config, above
    ignoreProjectFrontmatter: true,
  });
  if (fs.existsSync(join(path, '_toc.yml'))) log(toc(`🚀 Pulled ${path} in %s`));
}

/**
 * Pull content for all projects in the site config
 *
 * Errors if no site config is loaded in the state.
 */
export async function pullProjects(session: ISession, opts: { level?: LogLevel }) {
  const state = session.store.getState();
  const siteConfig = selectors.selectLocalSiteConfig(state);
  if (!siteConfig) throw Error('Cannot pull projects: no site config');
  const limit = pLimit(1);
  await Promise.all(
    siteConfig.projects.map(async (proj) => {
      return limit(async () => pullProject(session, proj.path, opts));
    }),
  );
}

export async function pullDocument(session: ISession, file: string) {
  const frontmatter = await getRawFrontmatterFromFile(session, file);
  if (!frontmatter?.oxa) {
    throw new Error(`File ${file} does not have a "oxa" in the frontmatter.`);
  }
  switch (extname(file)) {
    case '.md':
      await oxaLinkToMarkdown(session, frontmatter.oxa, basename(file), { path: dirname(file) });
      break;
    case '.ipynb':
      await oxaLinkToNotebook(session, frontmatter.oxa, basename(file), { path: dirname(file) });
      break;
    default:
      throw new Error('Unrecognized extension to pull document.');
  }
}

type Options = {
  yes?: boolean;
};

/**
 * Pull new project content from curvenote.com
 *
 * If this is called from a folder with an existing site configuration and
 * no other path is specified, all projects included in the site are pulled.
 * Otherwise, a single project on the specified path is pulled.
 *
 * Errors if site config has no projects or if project does not exist
 * on specified path.
 */
export async function pull(session: ISession, path?: string, opts?: Options) {
  path = path || '.';
  if (!fs.existsSync(path)) {
    throw new Error(
      `Invalid path: "${path}", it must be a folder or file accessible from the local directory`,
    );
  }
  if (!isDirectory(path)) {
    await confirmOrExit(`Pulling will overwrite the file "${path}". Are you sure?`, opts);
    await pullDocument(session, path);
    return;
  }
  // Site config is loaded on session init
  const siteConfig = selectors.selectLocalSiteConfig(session.store.getState());
  if (path === '.' && siteConfig) {
    const numProjects = siteConfig.projects.length;
    if (numProjects === 0) throw new Error('Your site configuration has no projects');
    const plural = numProjects > 1 ? 's' : '';
    await confirmOrExit(
      `Pulling will overwrite all content in ${numProjects} project${plural}. Are you sure?`,
      opts,
    );
    await pullProjects(session, { level: LogLevel.info });
  } else {
    loadConfigOrThrow(session, path);
    await confirmOrExit(
      `Pulling will overwrite all content in ${
        path === '.' ? 'current directory' : path
      }. Are you sure?`,
      opts,
    );
    await pullProject(session, path, { level: LogLevel.info });
  }
}
