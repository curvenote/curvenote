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

/**
 * Initialize local curvenote project from folder or remote project
 *
 * It creates a new curvenote.yml file in the current directory with
 * both site and project configuration.
 *
 * This fails if curvenote.yml already exists; use `start` or `add`.
 */
export async function init(session: ISession, opts: Options) {
  if (!opts.yes) session.log.info(await WELCOME(session));
  if (opts.domain) session.log.info(`Using custom domain ${opts.domain}`);
  let currentPath = resolve('.');
  // Initialize config - error if it exists
  if (selectors.selectLocalSiteConfig(session.store.getState(), currentPath) && !opts.writeTOC) {
    throw Error(
      `Site config in ${CURVENOTE_YML} config already exists, did you mean to ${chalk.bold(
        'curvenote clone',
      )} or ${chalk.bold('curvenote start')}?`,
    );
  }
  const folderName = basename(currentPath);
  const siteConfig = getDefaultSiteConfig(folderName);

  // Load the user now, and wait for it below!
  let me: MyUser | Promise<MyUser> | undefined;
  if (!session.isAnon) me = new MyUser(session).get();

  const folderIsEmpty = fs.readdirSync(currentPath).length === 0;
  if (folderIsEmpty && opts.yes) throw Error('Cannot initialize an empty folder');
  let content;
  const projectConfigPaths = await findProjectsOnPath(session, currentPath);
  if ((!folderIsEmpty && opts.yes) || projectConfigPaths.length) {
    content = 'folder';
  } else {
    const response = await inquirer.prompt([questions.content({ folderIsEmpty })]);
    content = response.content;
  }
  let projectConfig: ProjectConfig | undefined = selectors.selectCurrentProjectConfig(
    session.store.getState(),
  );
  let pullComplete = false;
  let title = projectConfig?.title || siteConfig.title || undefined;
  if (content === 'folder') {
    if (projectConfigPaths.length > 0) {
      const pathListString = projectConfigPaths
        .map((p) => `  - ${join(p, CURVENOTE_YML)}`)
        .join('\n');

      session.log.info(
        `👀 ${chalk.bold(
          'Found existing project config files on your path:',
        )}\n${pathListString}\n`,
      );
    }
    if (projectConfig && opts.writeTOC && projectConfigPaths.length > 0) {
      if (projectConfig.toc) {
        session.log.warn('Not writing the table of contents, it already exists!');
        return;
      } else {
        await loadProjectFromDisk(session, currentPath, opts);
        return;
      }
    } else {
      if (!opts.yes) {
        const promptTitle = await inquirer.prompt([questions.title({ title: title || '' })]);
        title = promptTitle.title;
      }
      if (!projectConfig) {
        try {
          await loadProjectFromDisk(session, currentPath, { ...opts, writeTOC: false });
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
    }
    pullComplete = true;
  } else if (content === 'curvenote') {
    const results = await interactiveCloneQuestions(session);
    const { siteProject } = results;
    projectConfig = results.projectConfig;
    title = projectConfig.title;
    currentPath = siteProject.path;
  } else {
    throw Error(`Invalid init content: ${content}`);
  }
  // If there is a new project config, save to the state and write to disk
  if (projectConfig) {
    await writeConfigs(session, currentPath, { projectConfig });
    session.store.dispatch(config.actions.receiveCurrentProjectPath({ path: currentPath }));
  }
  // Personalize the config
  session.log.info(`📓 Creating site config`);
  me = await me;
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
  if (opts.writeTOC) {
    await loadProjectFromDisk(session, currentPath, { ...opts, reloadProject: true });
  }
  if (start) {
    session.log.info(chalk.dim('\nStarting local server with: '), chalk.bold('curvenote start'));
    await startServer(session, addOxaTransformersToOpts(session, opts));
  }
}
