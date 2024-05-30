import chalk from 'chalk';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { loadConfig, selectors, writeConfigs } from 'myst-cli';
import { LogLevel } from 'myst-cli-utils';
import type { ProjectConfig, SiteConfig } from 'myst-config';
import type { Project } from '../models.js';
import type { ISession } from '../session/types.js';
import { pullProject } from './pull/project.js';
import questions from './questions.js';
import type { SyncCiHelperOptions } from './types.js';
import {
  projectIdFromLink,
  getDefaultProjectConfig,
  getDefaultSiteConfigFromRemote,
  processOption,
  validateLinkIsAProject,
} from './utils.js';

type Options = {
  remote?: string;
  path?: string;
} & SyncCiHelperOptions;

export async function interactiveCloneQuestions(
  session: ISession,
  opts?: Options,
): Promise<{ siteProject: { path: string; slug: string }; projectConfig: ProjectConfig }> {
  // This is an interactive clone
  let project: Project | undefined;
  if (opts?.remote) {
    project = await validateLinkIsAProject(session, opts.remote);
    if (!project) throw new Error(`Invalid remote address: "${opts.remote}"`);
  } else {
    while (!project) {
      const { projectLink } = await inquirer.prompt([questions.projectLink()]);
      project = await validateLinkIsAProject(session, projectLink);
    }
  }
  let path: string;
  const defaultPath = '.';
  if (opts?.path || opts?.yes) {
    path = opts?.path ?? defaultPath;
    if (path !== '.' && fs.existsSync(path)) {
      throw new Error(`Invalid path for clone: "${path}", it must not exist.`);
    }
  } else {
    const promptConfirmPath = await inquirer.prompt([questions.projectPath(defaultPath)]);
    if (!promptConfirmPath.projectPath) throw new Error('Aborted');
    path = defaultPath;
  }
  try {
    // Throw if project doesn't exist - that's what we want!
    await loadConfig(session, path);
    if (!selectors.selectLocalProjectConfig(session.store.getState(), path)) throw Error();
  } catch {
    // Project config does not exist; good!
    const nonNullProjectData = Object.fromEntries(
      Object.entries(project.data).map(([key, item]) => [key, item === null ? undefined : item]),
    );
    const projectConfig = {
      ...(await getDefaultProjectConfig(project.data.title)),
      ...nonNullProjectData,
      remote: nonNullProjectData.id,
      id: nonNullProjectData.id,
    };
    return {
      siteProject: { path, slug: project.data.name },
      projectConfig,
    };
  }
  throw new Error(
    `Project already exists: "${path}" - did you mean to ${chalk.bold('curvenote pull')}`,
  );
}

/**
 * Interactively clone a project from curvenote.com to a given path
 *
 * If a site config is present, the project is also added to the site.
 */
export async function clone(session: ISession, remote?: string, path?: string, opts?: Options) {
  const processedOpts = processOption(opts);
  // Site config is loaded on session init
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    session.log.debug('Site config not found');
  }
  const { siteProject, projectConfig } = await interactiveCloneQuestions(session, {
    ...processedOpts,
    remote,
    path,
  });
  await writeConfigs(session, siteProject.path, { projectConfig });
  if (!siteConfig && remote) {
    // If there is no site config, but a remote is provided, create a config
    const newSiteConfig = await getDefaultSiteConfigFromRemote(
      session,
      projectIdFromLink(session, remote),
      siteProject,
    );
    await writeConfigs(session, '.', { siteConfig: newSiteConfig });
  } else if (siteConfig) {
    const newSiteConfig: SiteConfig = {
      ...siteConfig,
      nav: [
        ...(siteConfig?.nav || []),
        { title: projectConfig.title || '', url: `/${siteProject.slug}` },
      ],
      projects: [...(siteConfig?.projects || []), siteProject],
    };
    await writeConfigs(session, '.', { siteConfig: newSiteConfig });
  }
  await pullProject(session, siteProject.path, { level: LogLevel.info, ci: opts?.ci });
}
