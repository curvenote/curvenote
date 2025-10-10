import chalk from 'chalk';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { basename, resolve, join } from 'node:path';
import { config, findProjectsOnPath, selectors, writeConfigs, startServer } from 'myst-cli';
import { LogLevel, writeFileToFolder } from 'myst-cli-utils';
import type { ProjectConfig } from 'myst-config';
import { LOGO } from '../../docs.js';
import { MyUser } from '../../models.js';
import type { ISession } from '../../session/types.js';
import { pullProjects } from '../pull/project.js';
import questions from '../questions.js';
import { getDefaultSiteConfig, INIT_LOGO_PATH, cleanProjectConfigForWrite } from '../utils.js';
import { addOxaTransformersToOpts } from '../../utils/utils.js';
import type { Options } from './types.js';
import { CURVENOTE_YML } from './types.js';
import { WELCOME, FINISHED } from './messages.js';
import {
  validateExistingProject,
  handleWriteTOC,
  handleAddAuthors,
} from './modification-handlers.js';
import { handleImproveProject } from './improve-handler.js';
import {
  handleLocalFolderContent,
  handleCurvenoteImport,
  handleGithubImport,
} from './initialization-handlers.js';
import { writeTemplateFile } from './template-file.js';

/**
 * Initialize local curvenote project from folder or remote project
 *
 * This command has two modes:
 * 1. PROJECT MODIFICATION: Operations like --write-toc that modify existing projects
 * 2. PROJECT INITIALIZATION: Create a new project from local folder or Curvenote
 *
 * Creates a new curvenote.yml file with both site and project configuration.
 * Fails if curvenote.yml already exists (unless using modification mode).
 */
export async function init(session: ISession, opts: Options) {
  let currentPath = resolve('.');

  // ========================================================================
  // PROJECT MODIFICATION OPERATIONS
  // These operations modify existing projects and return early
  // Add new modification operations here by checking opts and calling handlers
  // ========================================================================

  // Handle --write-template: Write template.yml with default questions
  if (opts.writeTemplate) {
    await writeTemplateFile(session, currentPath);
    return;
  }

  // Handle --improve: Update existing project by re-answering template questions
  if (opts.improve) {
    const projectConfig = validateExistingProject(session, currentPath);
    await handleImproveProject(session, currentPath, projectConfig);
    return;
  }

  // Handle --write-toc: Generate table of contents
  if (opts.writeTOC) {
    const projectConfig = validateExistingProject(session, currentPath);
    await handleWriteTOC(session, currentPath, projectConfig);
    return;
  }

  // Handle --add-authors: Add authors to project
  if (opts.addAuthors !== undefined && opts.addAuthors !== false) {
    session.log.debug(`addAuthors option detected: ${JSON.stringify(opts.addAuthors)}`);
    const projectConfig = validateExistingProject(session, currentPath);
    const authorsInput = typeof opts.addAuthors === 'string' ? opts.addAuthors : undefined;
    await handleAddAuthors(session, currentPath, projectConfig, authorsInput);
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
  let githubUrl: string | undefined;
  let curvenoteUrl: string | undefined;

  const projectConfigPaths = await findProjectsOnPath(session, currentPath);

  // Handle --github option: set content to 'github' and store the URL
  if (opts.github) {
    session.log.debug(`GitHub option detected: ${opts.github}`);
    content = 'github';
    githubUrl = opts.github;
  } else if (opts.curvenote) {
    session.log.debug(`Curvenote option detected: ${opts.curvenote}`);
    content = 'curvenote';
    curvenoteUrl = opts.curvenote;
  } else if ((!folderIsEmpty && opts.yes) || projectConfigPaths.length) {
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
    // Curvenote import (interactive or CLI option)
    const result = await handleCurvenoteImport(session, currentPath, opts, curvenoteUrl);
    projectConfig = result.projectConfig;
    title = result.title;
    currentPath = result.currentPath;
    pullComplete = false;
  } else if (content === 'github') {
    // GitHub import (interactive or CLI option)
    const result = await handleGithubImport(session, currentPath, opts, githubUrl);
    projectConfig = result.projectConfig;
    title = result.title;
    currentPath = result.currentPath;
    pullComplete = true;
  } else {
    throw Error(`Invalid init content: ${content}`);
  }
  // If there is a new project config, save to the state and write to disk
  if (projectConfig) {
    await writeConfigs(session, currentPath, {
      projectConfig: cleanProjectConfigForWrite(projectConfig),
    });
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
  await writeConfigs(session, currentPath, { siteConfig });
  session.store.dispatch(config.actions.receiveCurrentSitePath({ path: currentPath }));

  const pullOpts = { level: LogLevel.debug };
  let pullProcess: Promise<void> | undefined;
  if (!pullComplete) {
    pullProcess = pullProjects(session, pullOpts).then(() => {
      pullComplete = true;
    });
  }

  if (siteConfig.options?.logo === INIT_LOGO_PATH) {
    const logoPath =
      currentPath === resolve('.') ? INIT_LOGO_PATH : join(currentPath, INIT_LOGO_PATH);
    writeFileToFolder(logoPath, LOGO);
  }

  // For Curvenote imports (--curvenote), wait for pull to complete and exit (non-interactive)
  const isCurvenoteImport = !!opts.curvenote;

  if (isCurvenoteImport) {
    if (!pullComplete) {
      pullOpts.level = LogLevel.info;
      session.log.info(
        `${chalk.dim('\nFinishing')} ${chalk.bold('curvenote pull')}${chalk.dim(
          '. This may take a minute ⏳...',
        )}`,
      );
      await pullProcess;
    }
    if (!opts.yes) session.log.info(await FINISHED(session));
    return;
  }

  // For GitHub imports (--github or interactive), continue with server prompt
  // Interactive mode: show completion message and continue
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
