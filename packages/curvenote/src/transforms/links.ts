import { castSession } from 'myst-cli';
import { fileWarn } from 'myst-common';
import type { LinkTransformer, Link } from 'myst-transforms';
import type { VFile } from 'vfile';
import { oxaLink, oxaLinkToId } from '@curvenote/blocks';
import type { ISession } from '../session/types.js';
import type { RootState } from '../store/index.js';
import { selectors } from '../store/index.js';
import { oxalink } from '../store/oxa/index.js';

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
    const externalOxaUrl = oxa ? oxaLink(this.session.SITE_URL, oxa.block) : null;
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

export async function transformOxalinkStore(
  session: ISession,
  opts: { file: string; projectSlug: string },
) {
  const cache = castSession(session);
  const mdastPost = cache.$mdast[opts.file].post;
  const oxa = mdastPost?.frontmatter.oxa;
  if (oxa) {
    session.store.dispatch(
      oxalink.actions.updateLinkInfo({
        path: opts.file,
        oxa: oxa,
        url: `/${opts.projectSlug}/${mdastPost.slug}`,
      }),
    );
  }
}
