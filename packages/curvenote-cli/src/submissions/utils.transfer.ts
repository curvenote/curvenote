import fs from 'fs/promises';
import { existsSync } from 'fs';
import yaml from 'js-yaml';
import { selectors, writeConfigs, createTempFolder } from 'myst-cli';
import { join } from 'node:path';
import chalk from 'chalk';
import { getFromJournals, postToJournals } from './utils.js';
import type { ISession } from '../session/types.js';

export type TransferDataItemData = {
  id: string;
  date_created: string;
};

export type TransferDataItem = {
  key?: string;
  work?: TransferDataItemData;
  workVersion?: TransferDataItemData;
  submission?: TransferDataItemData;
  submissionVersion?: TransferDataItemData;
};

export type TransferData = Record<string, TransferDataItem>;

function getTransferYmlPath(session: ISession) {
  const projectPath = selectors.selectCurrentProjectPath(session.store.getState());
  return join(projectPath ?? '.', 'transfer.yml');
}

export async function loadTransferFile(session: ISession): Promise<TransferData | null> {
  const filepath = getTransferYmlPath(session);
  if (!existsSync(filepath)) return null;
  const file = await fs.readFile(filepath, 'utf8');
  const data = yaml.load(file) as TransferData;
  if (data && !data.version) {
    session.log.info(chalk.bold.red('🚨 Invalid or outdated transfer.yml file, please remove it.'));
    process.exit(1);
  }
  return data;
}

export async function upwriteTransferFile(
  session: ISession,
  venue: string,
  data: Partial<TransferDataItem>,
): Promise<TransferData | null> {
  const filepath = './transfer.yml';
  const existing = (await loadTransferFile(session)) ?? {};
  const merged = {
    version: 1,
    ...existing,
    [venue]: {
      ...(existing[venue] ?? {}),
      ...data,
      key: data.key ?? existing[venue]?.key,
    },
  };
  await fs.writeFile(filepath, yaml.dump(merged), 'utf8');
  return loadTransferFile(session);
}

/**
 * Load work from transfer.yml data
 *
 * Returns undefined if work for the given venue is not defined or
 * if the API request for the work fails.
 */
export async function getWorkFromTransferData(
  session: ISession,
  data: TransferData,
  venue: string,
) {
  const workId = data[venue]?.work?.id;
  if (!workId) return;
  try {
    session.log.debug(`GET from journals API works/${workId}`);
    const resp = await getFromJournals(session, `works/${workId}`);
    return resp.key;
  } catch {
    return undefined;
  }
}

/**
 * Patch an existing work from transfer.yml with a new key
 */
export async function updateKeyForTransferDataWork(
  session: ISession,
  data: TransferData,
  venue: string,
  key: string,
) {
  const workId = data[venue]?.work?.id;
  if (!workId) {
    session.log.error(`Cannot update work key using transfer.yml`);
    return;
  }
  try {
    session.log.debug(`PATCH to journals API works/${workId}`);
    const resp = await postToJournals(session, `works/${workId}`, { key }, { method: 'PATCH' });
    if (resp.ok) return;
  } catch {
    session.log.debug(`Error patching works/${workId}`);
  }
  session.log.error(`Cannot update key for work id ${workId}`);
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
  const projectConfig = selectors.selectLocalProjectConfig(state, path);
  const tempFolder = createTempFolder(session);
  session.log.info(`creating backup copy of config file ${file} -> ${tempFolder}`);
  await fs.copyFile(file, join(tempFolder, 'curvenote.yml'));
  session.log.info(`writing work key to ${file}`);
  writeConfigs(session, path, { projectConfig: { ...projectConfig, id: key } });
}
