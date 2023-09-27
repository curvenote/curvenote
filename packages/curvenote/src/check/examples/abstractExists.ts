import path from 'node:path';
import { loadProjectFromDisk, selectFile } from 'myst-cli';
import { copyNode, extractPart } from 'myst-common';
import type { ISession } from '../../session/types.js';
import { CheckStatus, type CheckInterface } from '../types.js';

export const abstractExists: CheckInterface = {
  id: 'abstract-exists',
  title: 'Abstract Exists',
  description: 'Ensure abstract exists in MyST project',
  category: 'abstract',
  validate: async (session: ISession) => {
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) {
      return { status: CheckStatus.error, message: `Error loading content from ${file}`, file };
    }
    const abstract = extractPart(copyNode(mdast), 'abstract');
    if (!abstract) {
      return { status: CheckStatus.fail, message: `No abstract found in ${file}`, file };
    }
    return {
      status: CheckStatus.pass,
      message: `Abstract exists!`,
      file,
      position: abstract.position,
    };
  },
};
