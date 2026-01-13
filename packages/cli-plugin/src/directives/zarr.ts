import type { DirectiveSpec } from 'myst-common';
import { u } from 'unist-builder';
import { makePlaceholder, validateStringOptions } from '../utils.js';

// TODO: talk to package manager
const VIZARR_URL = 'https://curvenote.github.io/widgets/widgets/vizarr-viewer.js';

export const zarrViewer: DirectiveSpec = {
  name: 'zarr',
  doc: 'Embed a Zarr image viewer',
  arg: {
    type: String,
    required: true,
    doc: 'A URL to the Zarr file',
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
    viewer: {
      type: String,
      required: false,
      doc: 'The viewer to use (default: "vizarr")',
    },
    height: {
      type: String,
      required: false,
      doc: 'The height of the embedded viewer container set via style',
    },
  },
  validate(data, vfile) {
    // TODO: validate the URL for the esm
    validateStringOptions(vfile, 'arg', data.arg);
    if (data.options?.class) validateStringOptions(vfile, 'class', data.options?.class);
    if (data.options?.styles) validateStringOptions(vfile, 'styles', data.options?.styles);
    if (data.options?.css) validateStringOptions(vfile, 'css', data.options?.css);
    if (data.options?.veiwer) validateStringOptions(vfile, 'viewer', data.options?.viewer);
    if (data.options?.height) validateStringOptions(vfile, 'height', data.options?.height);
    if (
      !data.options?.viewer &&
      ((data.options?.viewer as string) ?? '').length > 0 &&
      data.options?.viewer !== 'vizarr'
    ) {
      vfile.message(`Invalid viewer supplied: ${data.options?.viewer}.`);
    }
    return data;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run(data, _vfile, _opts) {
    const viewer = data.options?.viewer ?? 'vizarr';

    let viewerUrl = VIZARR_URL; // default
    switch (viewer) {
      case 'vizarr':
      default:
        viewerUrl = VIZARR_URL;
    }

    const block = u(
      'block',
      {
        kind: 'any:bundle',
        data: {
          js: viewerUrl,
          class: data.options?.class ?? '',
          css: '',
          json: {
            directive: 'zarr',
            source: data.arg,
            height: data.options?.height ?? '600px',
          },
        },
      },
      makePlaceholder(data, data.arg as string),
    );

    return [block];
  },
};
