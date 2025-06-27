import { v4 as uuid } from 'uuid';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import type { ExportWithOutput } from 'myst-cli';
import { ExportFormats } from 'myst-frontmatter';
import AdmZip from 'adm-zip';
import {
  selectors,
  writeConfigs,
  createTempFolder,
  buildSite,
  clean,
  collectAllBuildExportOptions,
  localArticleExport,
  runMecaExport,
} from 'myst-cli';
import { join, relative, dirname } from 'node:path';
import type { WorkDTO } from '@curvenote/common';
import * as uploads from '../uploads/index.js';
import type { ISession } from '../session/types.js';
import chalk from 'chalk';
import { getFromJournals } from '../utils/api.js';
import { addOxaTransformersToOpts } from '../utils/utils.js';
import type { BaseOpts } from '../logs/types.js';

export const CDN_KEY_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const DEV_CDN_KEY = 'ad7fa60f-5460-4bf9-96ea-59be87944e41';

/**
 * Create a zip file containing the source contents from a MECA export
 */
async function createSourceZip(session: ISession) {
  session.log.info('📦 Bundling MECA bundle to extract source files...');

  try {
    const state = session.store.getState();
    const projectPath = selectors.selectCurrentProjectPath(state);
    if (!projectPath) {
      session.log.debug('No project path found');
      return;
    }
    const projectFile = selectors.selectLocalConfigFile(state, projectPath);
    if (!projectFile) {
      session.log.debug('No project file found');
      return;
    }
    const mecaExport: ExportWithOutput = {
      format: ExportFormats.meca,
      output: join(session.buildPath(), 'temp', 'meca-export.zip'),
      articles: [],
    };
    await runMecaExport(session, projectFile, mecaExport, { projectPath });

    const mecaZipPath = mecaExport.output;
    if (
      await fs
        .access(mecaZipPath)
        .then(() => false)
        .catch(() => true)
    ) {
      session.log.debug('MECA export file not created');
      return;
    }
    const zip = new AdmZip(mecaZipPath);

    // Extract the source files from MECA bundle folder
    const sourceEntries = zip
      .getEntries()
      .filter((entry) => entry.entryName.startsWith('bundle/') && entry.entryName !== 'bundle/');

    if (sourceEntries.length === 0) {
      session.log.debug('No source files found in MECA export');
      return;
    }
    // Create a new zip with just the source contents
    const sourceZip = new AdmZip();
    sourceEntries.forEach((entry) => {
      const relativePath = entry.entryName.replace(/^bundle\//, '');
      sourceZip.addFile(relativePath, entry.getData());
    });
    const sourceZipPath = join(session.sitePath(), 'source.zip');
    await fs.mkdir(dirname(sourceZipPath), { recursive: true });
    sourceZip.writeZip(sourceZipPath);
    session.log.info(`✅ Source zip created`);

    // Clean up the temporary MECA zip
    await fs.unlink(mecaZipPath);
  } catch (error) {
    session.log.debug(`Failed to create source zip: ${error}`);
  }
}

export async function performCleanRebuild(session: ISession, opts?: BaseOpts) {
  session.log.info('\n\n\t✨✨✨  performing a clean re-build of your work  ✨✨✨\n\n');
  await clean(session, [], { site: true, html: true, temp: true, exports: true, yes: true });
  const exportOptionsList = await collectAllBuildExportOptions(session, [], { all: true });
  const exportLogList = exportOptionsList.map((exportOptions) => {
    return `${relative('.', exportOptions.$file)} -> ${exportOptions.output}`;
  });
  session.log.info(`📬 Performing exports:\n   ${exportLogList.join('\n   ')}`);
  await localArticleExport(session, exportOptionsList, {});
  session.log.info(`⛴  Exports complete`);
  // Build the files in the content folder and process them
  await buildSite(session, addOxaTransformersToOpts(session, opts ?? {}));
  // Create source zip from MECA export
  await createSourceZip(session);
  session.log.info(`✅ Work rebuild complete`);
}

export async function uploadAndGetCdnKey(
  session: ISession,
  cdn: string,
  opts?: { resume?: boolean },
) {
  if (!process.env.DEV_CDN || process.env.DEV_CDN === 'false') {
    const uploadResult = await uploads.uploadToCdn(session, cdn, opts);
    return uploadResult.cdnKey;
  }
  if (process.env.DEV_CDN.match(CDN_KEY_RE)) {
    session.log.info(chalk.bold('Skipping upload, using DEV_CDN from environment'));
    return process.env.DEV_CDN;
  }
  session.log.info(chalk.bold('Skipping upload, using default DEV_CDN_KEY'));
  return DEV_CDN_KEY;
}

/**
 * Get project.id from the current config file
 *
 * The project.id will be used as journals work key
 *
 * If no config file is found this exits
 * If config file exists but project.id is not defined,
 * this returns undefined.
 */
export function workKeyFromConfig(session: ISession) {
  session.log.debug('Looking for key from config file');
  const state = session.store.getState();
  const projectConfigFile = selectors.selectCurrentProjectFile(state);
  if (!projectConfigFile) {
    session.log.error('No project configuration found');
    process.exit(1);
  }
  session.log.debug(`Found config file: ${projectConfigFile}`);
  const projectConfig = selectors.selectCurrentProjectConfig(state);
  return projectConfig?.id;
}

/**
 * Load work from transfer.yml data
 *
 * Returns undefined if work for the given venue is not defined or
 * if the API request for the work fails.
 */
export async function getWorkFromKey(session: ISession, key: string): Promise<WorkDTO | undefined> {
  try {
    session.log.debug(`GET from journals API /my/works?key=${key}`);
    const resp = await getFromJournals(session, `/my/works?key=${key}`);
    return resp.items[0];
  } catch {
    return undefined;
  }
}

/**
 * Prompt user for a new work key
 *
 * First, gives a simple Y/n with a default UUID. If the user is unhappy with that,
 * they are prompted to write their own key.
 *
 * This key cannot already exist as a work key; if you want to link to an existing
 * work, you must put the key directly in your project config file.
 */
export async function promptForNewKey(
  session: ISession,
  opts?: { yes?: boolean },
): Promise<string> {
  const defaultKey = uuid();
  if (opts?.yes) {
    session.log.debug(`Using autogenerated key: ${defaultKey}`);
    return defaultKey;
  }
  const { useDefault } = await inquirer.prompt([
    {
      name: 'useDefault',
      message: `Work key is required. Use autogenerated value? (${defaultKey})`,
      type: 'confirm',
      default: true,
    },
  ]);
  if (useDefault) return defaultKey;
  const { customKey } = await inquirer.prompt([
    {
      name: 'customKey',
      type: 'input',
      message: 'Enter a unique key for your work?',
      validate: async (key: string) => {
        if (key.length < 8) {
          return 'Key must be at least 8 characters';
        }
        if (key.length > 50) {
          return 'Key must be no more than 50 characters';
        }
        try {
          const { exists } = await getFromJournals(session, `/works/key/${key}`);
          if (exists) return `Key "${key}" not available.`;
        } catch (err) {
          return 'Key validation failed';
        }
        return true;
      },
    },
  ]);
  return customKey;
}

/**
 * Updates project.id in config yaml with key
 *
 * Creates a backup of the original file in the _build/temp folder
 */
export async function writeKeyToConfig(session: ISession, key: string) {
  const state = session.store.getState();
  const path = selectors.selectCurrentProjectPath(state);
  const file = selectors.selectCurrentProjectFile(state);
  if (!file || !path) {
    session.log.error('No project configuration found');
    process.exit(1);
  }
  const projectConfig = selectors.selectLocalProjectConfig(state, path);
  const tempFolder = createTempFolder(session);
  session.log.info(`creating backup copy of config file ${file} -> ${tempFolder}`);
  await fs.copyFile(file, join(tempFolder, 'curvenote.yml'));
  session.log.info(`writing work key to ${file}`);
  await writeConfigs(session, path, { projectConfig: { ...projectConfig, id: key } });
}

export function exitOnInvalidKeyOption(session: ISession, key: string) {
  session.log.debug(`Checking for valid key option: ${key}`);
  if (key.length < 8 || key.length > 128) {
    session.log.error(`⛔️ The key must be between 8 and 128 characters long.`);
    process.exit(1);
  }
}
