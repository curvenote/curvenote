import chalk from 'chalk';
import inquirer from 'inquirer';
import { join } from 'node:path';
import { loadProjectFromDisk, selectors } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import type { ISession } from '../../session/types.js';
import { interactiveCloneQuestions } from '../clone.js';
import questions from '../questions.js';
import { getDefaultProjectConfig } from '../utils.js';
import type { Options } from './types.js';
import { CURVENOTE_YML } from './types.js';

// ============================================================================
// PROJECT INITIALIZATION HANDLERS
// These functions create NEW projects from different sources
// ============================================================================

/**
 * Handle initialization from local folder content
 */
export async function handleLocalFolderContent(
  session: ISession,
  currentPath: string,
  projectConfigPaths: string[],
  opts: Options,
  existingProjectConfig?: ProjectConfig,
  existingTitle?: string,
): Promise<{ projectConfig?: ProjectConfig; title?: string; currentPath: string }> {
  if (projectConfigPaths.length > 0) {
    const pathListString = projectConfigPaths
      .map((p) => `  - ${join(p, CURVENOTE_YML)}`)
      .join('\n');

    session.log.info(
      `👀 ${chalk.bold('Found existing project config files on your path:')}\n${pathListString}\n`,
    );
  }

  let title = existingTitle;
  if (!opts.yes) {
    const promptTitle = await inquirer.prompt([questions.title({ title: title || '' })]);
    title = promptTitle.title;
  }

  let projectConfig = existingProjectConfig;
  if (!projectConfig) {
    try {
      await loadProjectFromDisk(session, currentPath);
      session.log.info(`📓 Creating project config`);
      projectConfig = await getDefaultProjectConfig(title);
      projectConfigPaths.unshift(currentPath);
    } catch {
      if (!projectConfigPaths.length) {
        throw Error(`No markdown or notebook files found`);
      }
      session.log.info(`🧹 No additional markdown or notebook files found`);
    }
  }

  return { projectConfig, title, currentPath };
}

/**
 * Handle initialization from remote Curvenote project
 */
export async function handleCurvenoteImport(
  session: ISession,
  opts?: Options,
): Promise<{ projectConfig: ProjectConfig; title?: string; currentPath: string }> {
  const results = await interactiveCloneQuestions(session, opts);
  const { siteProject } = results;
  const projectConfig = results.projectConfig;
  const title = projectConfig.title;
  const currentPath = siteProject.path;

  return { projectConfig, title, currentPath };
}
