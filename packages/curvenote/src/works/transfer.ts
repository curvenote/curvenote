import fs from 'fs/promises';
import { existsSync } from 'fs';
import yaml from 'js-yaml';

export type TransferData = {
  work_id: string;
  work_version_id: string;
  submission_id: string;
};

export async function loadTransferFile(): Promise<TransferData | null> {
  const filepath = './transfer.yml';
  if (!existsSync(filepath)) return null;
  const file = await fs.readFile(filepath, 'utf8');
  return yaml.load(file) as TransferData;
}

export async function upwriteTransferFile(
  data: Partial<TransferData>,
): Promise<TransferData | null> {
  const filepath = './transfer.yml';
  const existing = (await loadTransferFile()) ?? {};
  const merged = {
    ...existing,
    ...data,
  };
  await fs.writeFile(filepath, yaml.dump(merged), 'utf8');
  return loadTransferFile();
}
