import fs from 'fs/promises';
import { existsSync } from 'fs';
import yaml from 'js-yaml';
import { selectors } from 'myst-cli';
import { join } from 'node:path';
import chalk from 'chalk';
import type { ISession } from '../session/types.js';
import { getFromJournals, postToJournals } from '../utils/api.js';
import { promptForNewKey, writeKeyToConfig } from '../works/utils.js';

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
    session.log.debug(`GET from journals API /works/${workId}`);
    const resp = await getFromJournals(session, `/works/${workId}`);
    return resp;
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
    session.log.debug(`PATCH to journals API /works/${workId}`);
    const resp = await postToJournals(session, `/works/${workId}`, { key }, { method: 'PATCH' });
    if (resp.ok) return;
  } catch {
    session.log.debug(`Error patching /works/${workId}`);
  }
  session.log.error(`Cannot update key for work id ${workId}`);
}

export async function keyFromTransferFile(
  session: ISession,
  venue: string,
  configKey?: string,
  opts?: { yes?: boolean },
): Promise<string | undefined> {
  const transferData = await loadTransferFile(session);
  if (!transferData) return;
  const configFile = selectors.selectCurrentProjectFile(session.store.getState());
  session.log.warn(`transfer.yml found - this file is deprecated`);
  session.log.debug(`checking work from transfer.yml for key...`);
  const work = await getWorkFromTransferData(session, transferData, venue);
  if (!work) {
    session.log.info(`Could not load work for venue "${venue}" - ignoring transfer.yml`);
  } else {
    const workKey: string | undefined = work.key;
    if (!workKey) {
      session.log.info(`Existing work from transfer.yml does not have key`);
      if (!configKey) {
        session.log.info(`No key specified in ${configFile}`);
        configKey = await promptForNewKey(session, opts);
        await writeKeyToConfig(session, configKey);
      }
      await updateKeyForTransferDataWork(session, transferData, venue, configKey);
      return configKey;
    } else if (configKey === workKey) {
      session.log.debug(`Work from transfer.yml agrees with ${configFile} id`);
    } else {
      if (configKey) {
        session.log.warn(
          `Key in ${configFile} (${configKey}) will be replaced by key from work specified by transfer.yml (${workKey})`,
        );
      }
      // this message should be in writeKeyToConfig...
      session.log.info(`writing work key to ***.yml - previous version was saved to ****.yml`);
      await writeKeyToConfig(session, workKey);
      return workKey;
    }
  }
}
