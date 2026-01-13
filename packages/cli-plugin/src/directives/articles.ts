import type { DirectiveSpec, GenericNode } from 'myst-common';
import { validateStringOptions, makePlaceholder } from '../utils.js';

export const articlesDirective: DirectiveSpec = {
  name: 'cn:articles',
  doc: 'A listing directive that can be used to show a list of articles from a specific venue, collection or kind.',
  options: {
    venue: {
      type: String,
      doc: 'The venue to list articles from, if not provided, the current venue will be used.',
      required: false,
    },
    collection: {
      type: String,
      doc: 'The collection to list articles from.',
      required: false,
    },
    status: {
      type: String,
      doc: 'The status of articles to list (published | in-review).',
      required: false,
    },
    'submission-kind': {
      type: String,
      doc: 'The kind of articles to list.',
      required: false,
    },
    layout: {
      type: String,
      doc: 'The layout of the of articles (list | cards).',
      required: false,
    },
    wide: {
      type: Boolean,
      doc: 'If set, the listing will be wide.',
      required: false,
    },
    limit: {
      type: Number,
      doc: 'The maximum number of articles to list.',
      required: false,
    },
    pagination: {
      type: String,
      doc: 'If `limit` is set, this gives a hint to the renderer on how to handle pagination (more | all | scroll).',
      required: false,
    },
    'show-collection': {
      type: Boolean,
      doc: 'If set to true, the listing will show the collection name.',
      required: false,
    },
    'show-kind': {
      type: Boolean,
      doc: 'If set to true, the listing will show the kind name.',
      required: false,
    },
    'show-date': {
      type: Boolean,
      doc: 'If set to true, the listing will not show the publication date.',
      required: false,
    },
    'show-thumbnails': {
      type: Boolean,
      doc: 'If set to true, the listing will not show thumbnails.',
      required: false,
    },
    'show-count': {
      type: Boolean,
      doc: 'If set to true, the total number of items in the listing will be shown.',
      required: false,
    },
    'show-authors': {
      type: Boolean,
      doc: 'If set to true, the listing will show the authors.',
      required: false,
    },
    'show-doi': {
      type: Boolean,
      doc: 'If set to true, the listing will show the DOI.',
      required: false,
    },
  },
  validate(data, vfile) {
    if (data.options?.status) {
      validateStringOptions(vfile, 'status', data.options?.status, ['published', 'in-review']);
    }
    if (data.options?.layout) {
      validateStringOptions(vfile, 'layout', data.options?.layout, ['list', 'cards']);
    }
    if (data.options?.pagination) {
      validateStringOptions(vfile, 'pagination', data.options?.pagination, [
        'more',
        'all',
        'scroll',
      ]);
    }

    // TODO get hold of session?
    // TODO lookup API and validate venue, collection, kind exist?
    // TODO how to validate against the correct API? dev/staging/prod?

    return data;
  },
  run(data) {
    return [
      {
        type: 'curvenoteArticles',
        ...data.options,
        layout: data.options?.layout ?? 'list',
        pagination: data.options?.pagination ?? 'more',
        children: makePlaceholder(
          data,
          `a live listing of articles from ${data.options?.venue ?? 'the current venue'}`,
        ),
      },
    ] as GenericNode[];
  },
};
