import path from 'node:path';
import { loadProjectFromDisk, resolveFrontmatterParts, selectFile } from 'myst-cli';
import { copyNode, extractPart } from 'myst-common';
import { getCheckDefinition } from '@curvenote/check-definitions';
import type { CheckInterface } from '../types.js';
import { error, fail, pass } from '../utils.js';

export const dataAvailabilityExists: CheckInterface = {
  ...getCheckDefinition('data-availability-exists'),
  validate: async (session) => {
    const { file } = await loadProjectFromDisk(session);
    const { mdast, frontmatter } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) return error('Error loading content', { file });
    const availability = extractPart(copyNode(mdast), 'availability', {
      frontmatterParts: resolveFrontmatterParts(session, frontmatter),
    });
    if (!availability)
      return fail('No availability statement found', {
        file,
        help: 'Add a data availability statement',
      });
    return pass('Availability statement exists!', {
      file,
      position: availability.position,
      nice: 'Data availability statement found 🔍',
    });
  },
};

export const dataAvailabilityRules = [dataAvailabilityExists];
