import { getCheckDefinition } from '@curvenote/check-definitions';
import type { CheckInterface } from '../types.js';
import { pass, fail, error } from '../utils.js';
import { getFrontmatter } from './utils.js';

export const keywordsDefined: CheckInterface = {
  ...getCheckDefinition('keywords-defined'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'keywords');
    const keywords = config?.keywords ?? [];
    if (keywords.length === 0) {
      return fail('No keywords found', { file, help: 'Add keywords to your project' });
    }
    return pass(`Found ${keywords.length} keywords`, {
      file,
      note: `Keywords: "${keywords.join('", "')}"`,
      nice: 'Keywords added 🔑',
    });
  },
};

export const keywordsLength: CheckInterface = {
  ...getCheckDefinition('keywords-length'),
  validate: async (session, options) => {
    const { file, config } = await getFrontmatter(session, 'keywords');
    const keywords = config?.keywords ?? [];
    const max = +options.max;
    if (keywords.length === 0) {
      return error('No keywords found', {
        file,
        cause: keywordsDefined.id,
        help: `Include up to ${max} keywords to your project`,
      });
    }
    // TODO: this should be a number in future!
    if (keywords.length > max) {
      return fail(`Too many keywords (${keywords.length}/${max})`, {
        file,
        help: `Remove ${keywords.length - max} keyword(s)`,
      });
    }
    return pass(`Correct number of keywords (${keywords.length}/${max})`, {
      file,
      nice: 'Correct number of keywords included 🔢',
    });
  },
};

export const keywordsUnique: CheckInterface = {
  ...getCheckDefinition('keywords-unique'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'keywords');
    const keywords = config?.keywords ?? [];
    if (keywords.length === 0) {
      return error('No keywords found', {
        file,
        cause: keywordsDefined.id,
        help: 'Ensure each keyword is unique',
      });
    }
    const set = new Set<string>();
    return keywords.map((k) => {
      const repeated = set.has(k);
      set.add(k);
      return repeated
        ? fail(`The keyword "${k}" is repeated`, {
            file,
            help: `Remove the duplicate keyword "${k}"`,
          })
        : pass(`First time keyword "${k}" encountered`, { file, nice: 'Keywords are unique 🔐' });
    });
  },
};

export const keywordsRules = [keywordsDefined, keywordsLength, keywordsUnique];
