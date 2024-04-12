import type { DirectiveSpec, GenericNode } from 'myst-common';
import { validateStringOptions } from '../utils.js';

export const collectionsDirective: DirectiveSpec = {
  name: 'cn:collections',
  doc: 'Create a listing of all collections available in the venue.',
  options: {
    venue: {
      type: String,
      doc: 'The venue to list articles from.',
      required: true,
    },
    show: {
      type: String,
      doc: 'The status of articles to list (open | closed | all).',
      required: false,
    },
    exclude: {
      type: String,
      doc: 'Collections to ignore, by name and comma separated.',
      required: false,
    },
  },
  validate(data, vfile) {
    if (!data.options?.venue) {
      vfile.message('A venue must be supplied.');
    }

    if (data.options?.exclude && typeof data.options?.exclude !== 'string') {
      vfile.message('exclude list should be a string of comma separated collection names.');
    }

    validateStringOptions(vfile, 'show', data.options?.show, ['open', 'closed', 'all']);

    return data;
  },
  run(data) {
    return [
      {
        type: 'curvenoteCollections',
        ...data.options,
        show: data.options?.show ?? 'all',
      },
    ] as GenericNode[];
  },
};
