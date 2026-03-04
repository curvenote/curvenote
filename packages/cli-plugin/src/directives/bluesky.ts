import { type DirectiveSpec, type GenericNode } from 'myst-common';

/**
 * Normalize the directive arg to a Bluesky handle or DID.
 * Accepts: full URL (https://bsky.app/profile/user101), short form (profile/user101), or plain handle/DID.
 */
function normalizeToHandle(arg: string): string {
  const trimmed = arg.trim().replace(/^@/, '');

  // Fully qualified URL: https://bsky.app/profile/handle (or other bsky host)
  try {
    const url = new URL(trimmed);
    if (url.pathname.startsWith('/profile/')) {
      return url.pathname.replace(/^\/profile\//, '').replace(/\/$/, '');
    }
  } catch {
    // Not a valid URL, continue
  }

  // Short form: profile/handle or profile/handle.bsky.social
  const profileMatch = trimmed.match(/^profile\/(.+)$/i);
  if (profileMatch) {
    return profileMatch[1];
  }

  return trimmed;
}

export const blueskyDirective: DirectiveSpec = {
  name: 'bluesky',
  doc: 'Embed an inline Bluesky profile card.',
  arg: {
    type: String,
    doc: 'Bluesky profile: full URL (e.g. `https://bsky.app/profile/user101`), short form (`profile/user101`), or handle/DID (`opensci.dev`, `did:plc:xyz`).',
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
    const handle = normalizeToHandle(data.arg as string);
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
