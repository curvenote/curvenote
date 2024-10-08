import path from 'node:path';
import { loadProjectFromDisk, selectFile } from 'myst-cli';
import type { GenericNode } from 'myst-common';
import { getCheckDefinition } from '@curvenote/check-definitions';
import type { CheckInterface } from '../types.js';
import { error, fail, pass } from '../utils.js';
import { selectAll } from 'unist-util-select';

export const figureCount: CheckInterface = {
  ...getCheckDefinition('figure-count'),
  validate: async (session, opts) => {
    const { kind, min, max } = opts;
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) return error('Error loading content', { file });
    const containers = selectAll('container', mdast) as GenericNode[];
    let kindMessage = '';
    let count = containers.length;
    if (kind) {
      count = containers.filter((c) => c.kind === kind).length;
      kindMessage = ` of kind "${kind}"`;
    }
    if (count > max) {
      return fail(`Document has too many figures${kindMessage}: ${count}/${max}`, {
        file,
        help: `Shorten your document to less than ${max} figures${kindMessage}`,
      });
    }
    if (count < min) {
      return fail(`Document has too few figures${kindMessage}: ${count}/${min}`, {
        file,
        help: `Increase number of figures${kindMessage} in your document to more than ${min}`,
      });
    }
    return pass(
      `Number of figures${kindMessage} is correct (${count}${max == null ? '' : `/${max}`})`,
      {
        file,
        nice: `Document has a good number of figures 🔢`,
      },
    );
  },
};

export const figureCountRules = [figureCount];
