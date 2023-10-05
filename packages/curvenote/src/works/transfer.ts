import fs from 'fs/promises';
import { existsSync } from 'fs';
import yaml from 'js-yaml';
import type { ISession } from '../index.js';
import { selectors } from 'myst-cli';
import path from 'node:path';

export type TransferData = {
  work_id: string;
  work_version_id: string;
  submission_id: string;
};

function getTransferYmlPath(session: ISession) {
  const projectPath = selectors.selectCurrentProjectPath(session.store.getState());
  return path.join(projectPath ?? '.', 'transfer.yml');
}

export async function loadTransferFile(session: ISession): Promise<TransferData | null> {
  const filepath = getTransferYmlPath(session);
  if (!existsSync(filepath)) return null;
  const file = await fs.readFile(filepath, 'utf8');
  return yaml.load(file) as TransferData;
}

export async function upwriteTransferFile(
  session: ISession,
  data: Partial<TransferData>,
): Promise<TransferData | null> {
  const filepath = './transfer.yml';
  const existing = (await loadTransferFile(session)) ?? {};
  const merged = {
    ...existing,
    ...data,
  };
  await fs.writeFile(filepath, yaml.dump(merged), 'utf8');
  return loadTransferFile(session);
}
