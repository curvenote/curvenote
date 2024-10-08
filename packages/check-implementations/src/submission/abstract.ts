import path from 'node:path';
import { loadProjectFromDisk, selectFile } from 'myst-cli';
import { copyNode, extractPart, toText } from 'myst-common';
import { count } from '@wordpress/wordcount';
import { error, fail, pass } from '../utils.js';
import type { CheckInterface } from '../types.js';
import { getCheckDefinition } from '@curvenote/check-definitions';

export const abstractExists: CheckInterface = {
  ...getCheckDefinition('abstract-exists'),
  validate: async (session) => {
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) return error('Error loading content', { file });
    const abstract = extractPart(copyNode(mdast), 'abstract');
    if (!abstract) {
      return fail(`No abstract found`, { file, help: 'Add an abstract' });
    }
    return pass(`Abstract exists`, {
      file,
      position: abstract.position,
      nice: 'Abstract exists 💯',
    });
  },
};

export const abstractLength: CheckInterface = {
  ...getCheckDefinition('abstract-length'),
  validate: async (session, options) => {
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    const help = `Abstract should be less than ${options.max} words`;
    if (!mdast) return error(`Error loading content`, { file, cause: abstractExists.id, help });
    const abstract = extractPart(copyNode(mdast), 'abstract');
    if (!abstract) {
      return error(`No abstract found`, {
        file,
        cause: abstractExists.id,
        help,
      });
    }
    const length = count(toText(abstract), 'words', {});
    if (length > options.max) {
      return fail(`Abstract is too long: ${length}/${options.max} words`, {
        file,
        position: abstract.position,
        help: `Shorten your abstract to less than ${options.max} words`,
      });
    }
    return pass(
      `Abstract is correct length (${length}${options.max == null ? '' : `/${options.max}`} words)`,
      {
        file,
        position: abstract.position,
        nice: 'Abstract is a good length 🔢',
      },
    );
  },
};

export const abstractRules = [abstractExists, abstractLength];
