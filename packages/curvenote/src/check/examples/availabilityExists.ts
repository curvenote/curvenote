import path from 'node:path';
import { loadProjectFromDisk, selectFile } from 'myst-cli';
import { copyNode, extractPart } from 'myst-common';
import type { ISession } from '../../session/types.js';
import { CheckStatus, type CheckInterface } from '../types.js';

export const availabilityExists: CheckInterface = {
  id: 'availability-exists',
  title: 'Availability Statement Exists',
  description: 'Ensure availability statement exists in MyST project',
  category: 'availability',
  validate: async (session: ISession) => {
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) {
      return { status: CheckStatus.error, message: `Error loading content`, file };
    }
    const availability = extractPart(copyNode(mdast), 'availability');
    if (!availability) {
      return {
        status: CheckStatus.fail,
        message: `No availability statement found`,
        file,
      };
    }
    return {
      status: CheckStatus.pass,
      message: `Availability statement exists!`,
      file,
      position: availability.position,
    };
  },
};
