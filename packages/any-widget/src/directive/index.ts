import type { DirectiveSpec } from 'myst-common';
import { u } from 'unist-builder';
import { makePlaceholder, validateStringOptions } from './utils.js';
import type { AnyWidgetDirective } from '../types.js';

export const anyWidget: DirectiveSpec = {
  name: 'any:widget',
  alias: ['any:bundle'],
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
    css: {
      type: String,
      required: false,
      doc: 'URL to the CSS file',
    },
    static: {
      type: String,
      required: false,
      doc: 'A file path, folder path or glob pattern to static files to make available to the module',
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
    if (data.options?.class) validateStringOptions(vfile, 'class', data.options?.class);
    if (data.options?.css) validateStringOptions(vfile, 'css', data.options?.css);
    if (data.options?.static) validateStringOptions(vfile, 'static', data.options?.static);
    validateStringOptions(vfile, 'body', data.body);

    // legacy
    if (data.options?.styles) validateStringOptions(vfile, 'styles', data.options?.styles);
    return data;
  },
  run(data, _vfile, _opts) {
    const body = data.body as string;

    const block = u(
      'block',
      {
        kind: 'any:widget',
        data: {
          esm: data.arg as string,
          json: JSON.parse(body) as Record<string, unknown>,
          css: (data.options?.css ?? data.options?.styles) as string | undefined,
          static: data.options?.static as string | undefined,
          class: data.options?.class as string | undefined,
          // legacy
          import: data.arg as string,
          styles: (data.options?.css ?? data.options?.styles) as string | undefined,
        },
      } satisfies Omit<AnyWidgetDirective, 'type'>,
      makePlaceholder(data, data.arg as string),
    );

    return [block];
  },
};
