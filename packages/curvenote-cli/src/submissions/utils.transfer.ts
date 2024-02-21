import fs from 'fs/promises';
import { existsSync } from 'fs';
import yaml from 'js-yaml';
import type { ISession } from '../index.js';
import { selectors } from 'myst-cli';
import path from 'node:path';
import chalk from 'chalk';

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
  return path.join(projectPath ?? '.', 'transfer.yml');
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
