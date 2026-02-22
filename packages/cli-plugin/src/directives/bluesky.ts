import { type DirectiveSpec, type GenericNode } from 'myst-common';

export const blueskyDirective: DirectiveSpec = {
  name: 'bluesky',
  doc: 'Embed an inline Bluesky profile card.',
  arg: {
    type: String,
    doc: 'The Bluesky handle or DID to display, e.g. `opensci.dev` or `did:plc:xyz`.',
    required: true,
  },
  options: {
    'show-stats': {
      alias: ['showStats'],
      type: Boolean,
      doc: 'Show follower, following, and post counts. Defaults to true.',
    },
  },
  run(data): GenericNode[] {
    const handle = (data.arg as string).trim().replace(/^@/, '');
    const showStats = (data.options?.['show-stats'] as boolean | undefined) ?? true;
    return [
      {
        type: 'block',
        kind: 'bluesky',
        data: { handle, showStats },
        children: [],
      },
    ];
  },
};
