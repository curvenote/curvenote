import path from 'node:path';
import {
  KNOWN_IMAGE_EXTENSIONS,
  createTempFolder,
  findCurrentProjectAndLoad,
  getFileContent,
  loadProjectFromDisk,
} from 'myst-cli';
import { extractPart } from 'myst-common';
import type { ISession } from '../../session/types.js';
import { CheckStatus, type CheckInterface } from '../types.js';

export const abstractExists: CheckInterface = {
  id: 'abstract-exists',
  title: 'Abstract Exists',
  description: 'Ensure abstract exists in MyST project',
  category: 'abstract',
  validate: async (session: ISession, file: string) => {
    try {
      const projectPath = await findCurrentProjectAndLoad(session, path.dirname(file));
      if (projectPath) {
        await loadProjectFromDisk(session, projectPath);
      }
      const [{ mdast }] = await getFileContent(session, [file], createTempFolder(session), {
        projectPath,
        useExistingImages: true,
        imageAltOutputFolder: 'files/',
        imageExtensions: KNOWN_IMAGE_EXTENSIONS,
        simplifyFigures: false,
      });
      const abstract = extractPart(mdast, 'abstract');
      if (!abstract) {
        return { status: CheckStatus.fail, message: `No abstract found in ${file}` };
      }
      return { status: CheckStatus.pass, message: `Abstract exists!` };
    } catch {
      return { status: CheckStatus.error, message: `Error loading content from ${file}` };
    }
  },
};
