import { oxaLink, oxaLinkToId } from '@curvenote/blocks';
import { SharedOptions } from '@curvenote/schema/dist/types';
import { Session } from '../../session/session';
import { ArticleState } from './walkArticle';
import { basekey } from './basekey';

export function localizationOptions(
  session: Session,
  imageFilenames: Record<string, string>,
  references: ArticleState['references'],
): SharedOptions {
  return {
    localizeImageSrc: (src) => imageFilenames[src],
    localizeId: (id) => id.split('#')[1], // TODO: this is a hack
    localizeCitation: (key) => references[basekey(key)].label,
    localizeLink: (href) => {
      const oxa = oxaLinkToId(href);
      if (!oxa) return href;
      return oxaLink(session.SITE_URL, oxa.block, oxa) as string;
    },
  };
}
