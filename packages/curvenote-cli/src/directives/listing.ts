import type { DirectiveData } from 'myst-common';
import type { VFile } from 'vfile';

export const listingDirective = {
  name: 'listing',
  doc: 'A listing directive that can be used to show a list of articles from a specific venue, collection or kind.',
  arg: {
    type: 'myst',
    doc: 'The title of the listing.',
  },
  body: {
    type: 'myst',
    doc: 'Descriptive content to be displayed along with the listing.',
  },
  options: {
    venue: {
      type: 'string',
      doc: 'The venue to list articles from.',
      required: true,
    },
    collection: {
      type: 'string',
      doc: 'The collection to list articles from.',
      required: false,
    },
    status: {
      type: 'string',
      doc: 'The status of articles to list (published | in-review).',
      required: false,
    },
    limit: {
      type: 'number',
      doc: 'The maximum number of articles to list.',
      required: false,
    },
    kind: {
      type: 'string',
      doc: 'The kind of listing to display (list | cards).',
      required: false,
    },
  },
  validate(data: DirectiveData, vfile: VFile) {
    if (!data.options?.venue) {
      vfile.message('A venue must be supplied.');
    }
    if (
      data.options?.status &&
      (typeof data.options.status !== 'string' ||
        (typeof data.options.status === 'string' &&
          !['published', 'in-review'].includes(data.options.status)))
    ) {
      vfile.message('Invalid status supplied.');
    }

    // TODO lookup API and validate venue, collection, kind exist?
    // TODO how to validate against the correct API? dev/staging/prod?

    return data;
  },
  run(data: DirectiveData) {
    return [
      {
        type: 'listing',
        title: data.arg,
        description: data.body,
        ...data.options,
        kind: data.options?.kind ?? 'list',
      },
    ]; // GenericNode
  },
};
