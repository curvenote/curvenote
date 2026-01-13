import chalk from 'chalk';
import inquirer from 'inquirer';
import { join, resolve, basename } from 'node:path';
import fs from 'node:fs';
import { v4 as uuid } from 'uuid';
import { loadProjectFromDisk, selectors, loadConfig } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import type { ISession } from '../../session/types.js';
import { interactiveCloneQuestions } from '../clone.js';
import questions from '../questions.js';
import { getDefaultProjectConfig, normalizeGithubUrl } from '../utils.js';
import type { Options } from './types.js';
import {
  DEFAULT_TEMPLATE_INIT_QUESTIONS,
  runTemplateInitQuestions,
} from './templateInitQuestions.js';

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
  // Note: The nested project paths are now shown in the nestedProjectChoice question
  // in index.ts, so we don't need to show them again here

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
  currentPath: string,
  opts: Options,
  providedCurvenoteUrl?: string,
): Promise<{ projectConfig: ProjectConfig; title?: string; currentPath: string }> {
  // Get Curvenote URL (from CLI option or interactive prompt)
  let curvenoteUrl = providedCurvenoteUrl;
  if (!curvenoteUrl) {
    const curvenoteResponse = await inquirer.prompt([questions.projectLink()]);
    curvenoteUrl = curvenoteResponse.projectLink;
  }
  if (!curvenoteUrl) {
    throw new Error('Curvenote project URL is required');
  }

  // Extract project name from URL for default folder name
  // URL format: https://curvenote.com/@username/project-name
  let defaultPath = '.';
  if (providedCurvenoteUrl && !opts.output) {
    // Only set default folder for CLI mode (when URL was provided via --curvenote)
    const urlPath = curvenoteUrl.replace(/^https?:\/\/[^/]+\//, ''); // Remove domain
    const pathSegments = urlPath.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      defaultPath = pathSegments[pathSegments.length - 1]; // Last segment
    }
  }

  // Use the existing clone logic with the URL
  const results = await interactiveCloneQuestions(session, {
    ...opts,
    remote: curvenoteUrl,
    path: opts.output || (defaultPath !== '.' ? defaultPath : undefined),
  });
  const { siteProject } = results;
  const projectConfig = results.projectConfig;
  const title = projectConfig.title;
  const targetPath = siteProject.path;

  return { projectConfig, title, currentPath: targetPath };
}

/**
 * Handle initialization from GitHub repository template
 */
export async function handleGithubImport(
  session: ISession,
  currentPath: string,
  opts: Options,
  providedGithubUrl?: string,
): Promise<{ projectConfig?: ProjectConfig; title?: string; currentPath: string }> {
  session.log.info(`\n🔗 ${chalk.bold('Initializing from GitHub template...')}\n`);

  // Get GitHub URL (from CLI option or interactive prompt)
  let githubUrl = providedGithubUrl;
  if (!githubUrl) {
    const githubResponse = await inquirer.prompt([questions.githubUrl()]);
    githubUrl = githubResponse.githubUrl;
  }
  if (!githubUrl) {
    throw new Error('GitHub URL is required');
  }

  // Normalize the GitHub URL
  const cloneUrl = normalizeGithubUrl(githubUrl);
  session.log.debug(`Normalized GitHub URL: ${cloneUrl}`);

  // Determine target path
  const repoName = basename(cloneUrl, '.git');
  let targetFolder: string | undefined;

  // Get target folder from --output option or interactive prompt
  if (opts.output) {
    // CLI mode with --output option
    targetFolder = opts.output;
  } else if (!opts.github) {
    // Interactive mode: ask for target folder
    const folderResponse = await inquirer.prompt([
      questions.githubFolder({ defaultFolder: repoName }),
    ]);
    targetFolder = folderResponse.githubFolder;
  }
  // If opts.github is set but no opts.output, targetFolder remains undefined (uses repoName default)

  let targetPath: string;
  let displayName: string;

  if (targetFolder === '.') {
    // Clone into current directory
    targetPath = currentPath;
    displayName = basename(currentPath);
  } else {
    // Use provided folder or default to repo name
    const folderName = targetFolder || repoName;
    targetPath = resolve(currentPath, folderName);
    displayName = folderName;

    // Check if target directory already exists
    if (fs.existsSync(targetPath)) {
      throw new Error(
        `Directory "${folderName}" already exists. Please remove it or choose a different location.`,
      );
    }
  }

  session.log.info(`📥 Cloning repository to ${chalk.cyan(displayName)}...`);

  // Clone the repository using git command
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execPromise = promisify(exec);

  try {
    await execPromise(`git clone ${cloneUrl} ${targetPath}`, {
      cwd: currentPath,
    });
    session.log.info(chalk.green(`✓ Repository cloned successfully`));
  } catch (error) {
    throw new Error(
      `Failed to clone repository: ${(error as Error).message}\nPlease ensure you have git installed and the repository URL is correct.`,
    );
  }

  // Check for curvenote.yml or myst.yml
  const curvenoteYmlPath = join(targetPath, 'curvenote.yml');
  const mystYmlPath = join(targetPath, 'myst.yml');

  let configPath: string | undefined;
  if (fs.existsSync(curvenoteYmlPath)) {
    configPath = curvenoteYmlPath;
    session.log.info(`📄 Found ${chalk.bold('curvenote.yml')}`);
  } else if (fs.existsSync(mystYmlPath)) {
    configPath = mystYmlPath;
    session.log.info(`📄 Found ${chalk.bold('myst.yml')}`);
  }

  let projectConfig: ProjectConfig | undefined;
  let title: string | undefined;

  if (configPath) {
    // Load and validate the configuration
    try {
      session.log.info(`📖 Loading project configuration...`);
      await loadConfig(session, targetPath);
      const state = session.store.getState();
      projectConfig = selectors.selectLocalProjectConfig(state, targetPath);

      if (projectConfig) {
        title = projectConfig.title;
        session.log.info(chalk.green(`✓ Project configuration loaded: ${chalk.bold(title)}`));
      }
    } catch (error) {
      session.log.warn(
        `Warning: Found configuration file but failed to load it: ${(error as Error).message}`,
      );
      session.log.info(`Continuing with default project setup...`);
    }
  } else {
    session.log.info(
      chalk.yellow(
        `⚠️  No curvenote.yml or myst.yml found in the repository\nWill create a new project configuration.`,
      ),
    );
  }

  // If no valid config was found, try to load project from disk content
  if (!projectConfig) {
    try {
      await loadProjectFromDisk(session, targetPath);
      session.log.info(`📓 Creating project config from repository content`);
      const repoTitle = repoName.replace(/-/g, ' ').replace(/_/g, ' ');
      projectConfig = await getDefaultProjectConfig(repoTitle);
      title = repoTitle;
    } catch (error) {
      session.log.debug(`Could not load project from disk: ${(error as Error).message}`);
    }
  }

  // Always generate a new UUID for the project ID (don't reuse template's ID)
  if (projectConfig) {
    const newUuid = uuid();
    let newId: string;

    if (projectConfig.id) {
      // If template has an ID, append the new UUID after a hyphen
      newId = `${projectConfig.id}-${newUuid}`;
      session.log.debug(`Appending UUID to existing ID: ${projectConfig.id} -> ${newId}`);
    } else {
      // If no ID exists, just use the new UUID
      newId = newUuid;
      session.log.debug(`Generating new project ID: ${newId}`);
    }

    projectConfig = {
      ...projectConfig,
      id: newId,
    };
  }

  // Ask template initialization questions (both CLI --github and interactive modes)
  // Try to load custom questions from template.yml in the cloned directory
  if (projectConfig) {
    const templateMetadata = await runTemplateInitQuestions(
      session,
      targetPath,
      DEFAULT_TEMPLATE_INIT_QUESTIONS,
    );

    // Merge template metadata into project config
    projectConfig = {
      ...projectConfig,
      ...templateMetadata,
    };

    // Update title if provided
    if (templateMetadata.title) {
      title = templateMetadata.title;
    }
  }

  return { projectConfig, title, currentPath: targetPath };
}
