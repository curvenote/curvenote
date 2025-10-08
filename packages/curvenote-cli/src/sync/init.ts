import chalk from 'chalk';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { basename, join, resolve } from 'node:path';
import {
  config,
  findProjectsOnPath,
  loadProjectFromDisk,
  selectors,
  writeConfigs,
  startServer,
} from 'myst-cli';
import { LogLevel, writeFileToFolder } from 'myst-cli-utils';
import type { ProjectConfig } from 'myst-config';
import { docLinks, LOGO } from '../docs.js';
import { MyUser } from '../models.js';
import type { ISession } from '../session/types.js';
import { interactiveCloneQuestions } from './clone.js';
import { pullProjects } from './pull/project.js';
import questions from './questions.js';
import { getDefaultProjectConfig, getDefaultSiteConfig, INIT_LOGO_PATH } from './utils.js';
import { addOxaTransformersToOpts } from '../utils/utils.js';

const CURVENOTE_YML = 'curvenote.yml';

type Options = {
  branch?: string;
  force?: boolean;
  yes?: boolean;
  domain?: string;
  writeTOC?: boolean;
};

const WELCOME = async (session: ISession) => `

${chalk.bold.green('Welcome to the Curvenote CLI!!')} 👋

${chalk.bold('curvenote init')} walks you through creating a ${chalk.bold(CURVENOTE_YML)} file.

You can use this client library to:

 - ${chalk.bold('sync content')} to & from Curvenote
 - ${chalk.bold('build & export')} professional PDFs
 - create a ${chalk.bold('local website')} & deploy to ${chalk.blue(
   `https://${
     session.isAnon ? 'your' : (await new MyUser(session).get()).data.username
   }.curve.space`,
 )}

Find out more here:
${docLinks.overview}

`;

const FINISHED = async (session: ISession) => `

${chalk.bold(chalk.green('Curvenote setup is complete!!'))} 🚀

You can use this client library to:

  - ${chalk.bold('curvenote pull')}: Update your content to what is on https://curvenote.com
  - ${chalk.bold('curvenote start')}: Start a local web server now!
  - ${chalk.bold('curvenote deploy')}: Share content on ${chalk.blue(
    `https://${
      session.isAnon ? 'your' : (await new MyUser(session).get()).data.username
    }.curve.space`,
  )}

Find out more here:
${docLinks.overview}

`;

// ============================================================================
// PROJECT MODIFICATION HANDLERS
// These functions operate on EXISTING projects (require projectConfig)
// Add new project modification operations here
// ============================================================================

/**
 * Handle --write-toc option: Generate table of contents for existing project
 */
async function handleWriteTOC(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  if (projectConfig.toc) {
    session.log.warn('Not writing the table of contents, it already exists!');
    return;
  }
  await loadProjectFromDisk(session, currentPath, { writeTOC: true });
}

// Add more project modification handlers here, following the same pattern:
// - async function handleSomeOption(session, currentPath, projectConfig)
// - Validate preconditions (e.g., check if already exists)
// - Perform the operation
// - Log appropriately

/**
 * Helper to validate that a project config exists
 * Used by project modification operations
 */
function validateExistingProject(session: ISession, currentPath: string): ProjectConfig {
  const projectConfig = selectors.selectCurrentProjectConfig(session.store.getState());
  if (!projectConfig) {
    throw Error(
      `No project config found at ${currentPath}. Run ${chalk.bold('curvenote init')} first.`,
    );
  }
  return projectConfig;
}

// ============================================================================
// PROJECT INITIALIZATION HANDLERS
// These functions create NEW projects from different sources
// ============================================================================

/**
 * Handle initialization from local folder content
 */
async function handleLocalFolderContent(
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
async function handleCurvenoteImport(
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

/**
 * Initialize local curvenote project from folder or remote project
 *
 * It creates a new curvenote.yml file in the current directory with
 * both site and project configuration.
 *
 * This fails if curvenote.yml already exists; use `start` or `add`.
 */
export async function init(session: ISession, opts: Options) {
  let currentPath = resolve('.');

  // ========================================================================
  // PROJECT MODIFICATION OPERATIONS
  // These operations modify existing projects and return early
  // Add new modification operations here by checking opts and calling handlers
  // ========================================================================

  // Handle --write-toc: Generate table of contents
  if (opts.writeTOC) {
    const projectConfig = validateExistingProject(session, currentPath);
    await handleWriteTOC(session, currentPath, projectConfig);
    return;
  }

  // Add more project modification operations here following this pattern:
  // if (opts.someOption) {
  //   const projectConfig = validateExistingProject(session, currentPath);
  //   await handleSomeOption(session, currentPath, projectConfig);
  //   return;
  // }

  // ========================================================================
  // PROJECT INITIALIZATION FLOW
  // Everything below creates a NEW project (fails if project already exists)
  // ========================================================================

  if (!opts.yes) session.log.info(await WELCOME(session));
  if (opts.domain) session.log.info(`Using custom domain ${opts.domain}`);

  // Initialize config - error if it exists
  if (selectors.selectLocalSiteConfig(session.store.getState(), currentPath)) {
    throw Error(
      `Site config in ${CURVENOTE_YML} config already exists, did you mean to ${chalk.bold(
        'curvenote clone',
      )} or ${chalk.bold('curvenote start')}?`,
    );
  }

  // Load the user now, and wait for it below!
  let me: MyUser | Promise<MyUser> | undefined;
  if (!session.isAnon) me = new MyUser(session).get();

  // Determine content source
  const folderIsEmpty = fs.readdirSync(currentPath).length === 0;
  let content: string;
  const projectConfigPaths = await findProjectsOnPath(session, currentPath);
  if ((!folderIsEmpty && opts.yes) || projectConfigPaths.length) {
    content = 'folder';
  } else {
    const response = await inquirer.prompt([questions.content({ folderIsEmpty })]);
    content = response.content;
  }

  // Get initial project config and title
  let projectConfig: ProjectConfig | undefined = selectors.selectCurrentProjectConfig(
    session.store.getState(),
  );
  let title = undefined;
  let pullComplete = false;

  // Handle content source
  if (content === 'folder') {
    if (folderIsEmpty && opts.yes) throw Error('Cannot initialize an empty folder');

    const result = await handleLocalFolderContent(
      session,
      currentPath,
      projectConfigPaths,
      opts,
      projectConfig,
      title,
    );

    projectConfig = result.projectConfig;
    title = result.title;
    currentPath = result.currentPath;
    pullComplete = true;
  } else if (content === 'curvenote') {
    const result = await handleCurvenoteImport(session, opts);
    projectConfig = result.projectConfig;
    title = result.title;
    currentPath = result.currentPath;
    pullComplete = false;
  } else {
    throw Error(`Invalid init content: ${content}`);
  }
  // If there is a new project config, save to the state and write to disk
  if (projectConfig) {
    await writeConfigs(session, currentPath, { projectConfig });
    session.store.dispatch(config.actions.receiveCurrentProjectPath({ path: currentPath }));
  }

  // Create and personalize the site config
  session.log.info(`📓 Creating site config`);
  me = await me;
  const folderName = basename(currentPath);
  const siteConfig = getDefaultSiteConfig(folderName);
  siteConfig.title = title;
  siteConfig.options = { logo_text: title };
  if (me) {
    const { username, twitter } = me.data;
    siteConfig.domains = opts.domain
      ? [opts.domain.replace(/^http[s]*:\/\//, '')]
      : [`${username}.curve.space`];
    if (twitter) siteConfig.options.twitter = twitter;
  }
  // Save site config to state and write to disk
  await writeConfigs(session, '.', { siteConfig });
  session.store.dispatch(config.actions.receiveCurrentSitePath({ path: '.' }));

  const pullOpts = { level: LogLevel.debug };
  let pullProcess: Promise<void> | undefined;
  if (!pullComplete) {
    pullProcess = pullProjects(session, pullOpts).then(() => {
      pullComplete = true;
    });
  }

  if (siteConfig.options?.logo === INIT_LOGO_PATH) {
    writeFileToFolder(INIT_LOGO_PATH, LOGO);
  }

  if (!opts.yes) session.log.info(await FINISHED(session));

  let start = false;
  if (!opts.yes) {
    const promptStart = await inquirer.prompt([questions.start()]);
    start = promptStart.start;
  }
  if (!start && !opts.yes) {
    session.log.info(chalk.dim('\nYou can do this later with:'), chalk.bold('curvenote start'));
  }
  if (!pullComplete) {
    pullOpts.level = LogLevel.info;
    session.log.info(
      `${chalk.dim('\nFinishing')} ${chalk.bold('curvenote pull')}${chalk.dim(
        '. This may take a minute ⏳...',
      )}`,
    );
  }
  await pullProcess;
  if (start) {
    session.log.info(chalk.dim('\nStarting local server with: '), chalk.bold('curvenote start'));
    await startServer(session, addOxaTransformersToOpts(session, opts));
  }
}
