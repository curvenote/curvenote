import { castSession } from 'myst-cli';
import { fileWarn } from 'myst-common';
import type { LinkTransformer } from 'myst-transforms';
import type { VFile } from 'vfile';
import { oxaLink, oxaLinkToId } from '@curvenote/blocks';
import type { ISession } from '../session/types.js';
import type { RootState } from '../store/index.js';
import { selectors } from '../store/index.js';
import { oxalink } from '../store/oxa/index.js';
import type { Link } from 'myst-spec-ext';
import type { Text } from 'myst-spec';

/**
 * Populate link node with rich oxa info
 */
export class OxaTransformer implements LinkTransformer {
  protocol = 'oxa';
  session: ISession;

  constructor(session: ISession) {
    this.session = session;
  }

  test(url?: string) {
    if (!url) return false;
    const oxa = oxaLinkToId(url);
    return !!oxa;
  }

  transform(link: Link, file: VFile) {
    const urlSource = link.urlSource || link.url;
    const oxa = oxaLinkToId(urlSource);
    const key = oxaLink(oxa, false) as string;
    const store = this.session.store.getState() as RootState;
    const info = selectors.selectOxaLinkInformation(store, key);
    const externalOxaUrl = oxa ? oxaLink(this.session.config.editorUrl, oxa.block) : null;
    if (info) {
      const url = info?.url;
      if (url && url !== link.url) {
        // the `internal` flag is picked up in the link renderer (prefetch!)
        link.internal = true;
        link.url = url;
        // TODO: Link blocks!
        // if (link.type === 'linkBlock') {
        //   // Any values already present on the block override link info
        //   link.title = link.title || info?.title || undefined;
        //   if (!link.children || link.children.length === 0) {
        //     link.children = [{ type: 'text', value: info?.description || '' }];
        //   }
        //   link.thumbnail = link.thumbnail || info?.thumbnail;
        // }
      }
    } else if (externalOxaUrl) {
      fileWarn(file, `Replacing oxa link with external url: ${externalOxaUrl}`, { node: link });
      link.url = externalOxaUrl;
    } else {
      fileWarn(file, `Information for link not found: ${key}`, { node: link });
    }
    return true;
  }
}

const BSKY_HOST = 'bsky.app';
const BSKY_TRANSFORM_SOURCE = 'LinkTransform:Bluesky';

type BlueskyProfileLink = {
  kind: 'profile';
  handle: string;
};

type BlueskyPostLink = {
  kind: 'post';
  handle: string;
  postId: string;
};

function updateLinkTextIfEmpty(link: Link, title: string) {
  if (!title) return;
  const text: Text[] = [{ type: 'text', value: title }];
  if (
    link.children?.length === 1 &&
    (link.children[0] as Text)?.type === 'text' &&
    (link.children[0] as Text)?.value === (link.urlSource || link.url)
  ) {
    link.children = text;
    return;
  }
  if (!link.children || link.children.length === 0) {
    link.children = text;
  }
}

function parseBlueskyUrl(
  urlSource: string,
): undefined | [string, BlueskyProfileLink | BlueskyPostLink] {
  let url: URL;
  try {
    url = new URL(urlSource);
  } catch {
    return undefined;
  }
  if (url.host !== BSKY_HOST) return undefined;

  // Post: /profile/{handle}/post/{rkey}
  const postMatch = url.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)/);
  if (postMatch) {
    const [, handle, postId] = postMatch;
    return [`@${handle}`, { kind: 'post', handle, postId }];
  }

  // Profile: /profile/{handle}
  const profileMatch = url.pathname.match(/^\/profile\/([^/]+)/);
  if (profileMatch) {
    const [, handle] = profileMatch;
    return [`@${handle}`, { kind: 'profile', handle }];
  }

  return undefined;
}

/**
 * Recognizes Bluesky profile and post links and enriches them with
 * structured data so the frontend can render Bluesky cards/hovercards.
 *
 * Supported URL forms:
 *   https://bsky.app/profile/{handle}
 *   https://bsky.app/profile/{handle}/post/{rkey}
 */
export class BlueskyTransformer implements LinkTransformer {
  protocol = 'bluesky';

  test(uri?: string): boolean {
    if (!uri) return false;
    try {
      const url = new URL(uri);
      return url.host === BSKY_HOST && url.pathname.startsWith('/profile');
    } catch {
      return false;
    }
  }

  transform(link: Link, file: VFile): boolean {
    const urlSource = link.urlSource || link.url;
    const parsed = parseBlueskyUrl(urlSource);
    if (!parsed) {
      fileWarn(file, `Found Bluesky URL but could not parse it: ${urlSource}`, {
        node: link,
        source: BSKY_TRANSFORM_SOURCE,
      });
      return false;
    }
    const [defaultText, data] = parsed;
    link.data = { ...link.data, ...data };
    link.internal = false;
    updateLinkTextIfEmpty(link, defaultText);
    return true;
  }
}

export async function transformOxalinkStore(
  session: ISession,
  opts: { file: string; projectSlug?: string },
) {
  const cache = castSession(session);
  const mdastPost = cache.$getMdast(opts.file)?.post;
  const oxa = mdastPost?.frontmatter.oxa;
  if (oxa) {
    const url = opts.projectSlug ? `/${opts.projectSlug}/${mdastPost.slug}` : `/${mdastPost.slug}`;
    session.store.dispatch(
      oxalink.actions.updateLinkInfo({
        path: opts.file,
        oxa: oxa,
        url,
      }),
    );
  }
}
