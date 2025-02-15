import type { DirectiveSpec } from 'myst-common';
import { u } from 'unist-builder';
import { makePlaceholder, validateStringOptions } from '../../utils.js';

export const anyBundle: DirectiveSpec = {
  name: 'any:bundle',
  doc: 'Embed a bundled AnyWidget component with data in the body',
  arg: {
    type: String,
    required: true,
    doc: 'A URL to the AnyWidget component bundle',
  },
  options: {
    class: {
      type: String,
      required: false,
      doc: 'Tailwind classes to apply to the container element',
    },
    styles: {
      type: String,
      required: false,
      doc: 'URL to the CSS file',
    },
  },
  body: {
    doc: 'JSON object with props to pass down to the component',
    type: String,
    required: true,
  },
  validate(data, vfile) {
    // TODO: validate the URL for the esm
    validateStringOptions(vfile, 'arg', data.arg);
    validateStringOptions(vfile, 'class', data.options?.class);
    validateStringOptions(vfile, 'styles', data.options?.styles);
    validateStringOptions(vfile, 'body', data.body);
    return data;
  },
  run(data, _vfile, _opts) {
    const body = data.body as string;

    const block = u(
      'block',
      {
        kind: 'any:bundle',
        data: {
          import: data.arg,
          class: data.options?.class ?? '',
          styles: data.options?.styles ?? '',
          json: JSON.parse(body),
        },
      },
      makePlaceholder(data, data.arg as string),
    );

    return [block];
  },
};
