import fetch from 'node-fetch';
import {
  VersionId,
  KINDS,
  oxaLinkToId,
  oxaLink,
  Blocks,
  FigureStyles,
  OutputSummaryKind,
  ReferenceFormatTypes,
} from '@curvenote/blocks';
import { DEFAULT_IMAGE_WIDTH, nodeNames, Nodes, ReferenceKind } from '@curvenote/schema';
import { Session } from '../../session';
import { getEditorState } from '../../actions/utils';
import { Block, Version } from '../../models';
import { getLatestVersion } from '../../actions/getLatest';
import { getImageSrc } from './getImageSrc';

export type ArticleState = {
  children: { state?: ReturnType<typeof getEditorState>; version?: Version }[];
  images: Record<string, Version<Blocks.Image | Blocks.Output>>;
  references: Record<string, { label: string; bibtex: string; version: Version<Blocks.Reference> }>;
};

function getFigureHTML(
  id: string,
  src: string,
  title: string,
  caption: string,
  style: FigureStyles,
) {
  const { width = DEFAULT_IMAGE_WIDTH, align = 'center', numbered = false } = style;
  return `<figure id="${id}"${numbered ? ' numbered=""' : ''} align="${align}">
  <img src="${src}" align="${align}" alt="${title}" width="${width}%">
  <figcaption kind="fig">${caption}</figcaption>
</figure>`;
}

function outputHasImage(version: Version<Blocks.Output>) {
  return version.data.outputs.reduce((found, { kind }) => {
    return found || kind === OutputSummaryKind.image;
  }, false);
}

export async function walkArticle(session: Session, data: Blocks.Article): Promise<ArticleState> {
  const images: ArticleState['images'] = {};
  const referenceKeys: Set<string> = new Set();
  const references: ArticleState['references'] = {};

  const children: ArticleState['children'] = await Promise.all(
    data.order.map(async (k) => {
      const articleChild = data.children[k];
      const srcId = articleChild?.src;
      const style = articleChild?.style ?? {};
      if (!srcId) return {};
      const childBlock = await new Block(session, srcId).get();
      const childVersion = await new Version(session, srcId).get();

      // Do not walk the content if it shouldn't be walked
      if (new Set(childBlock.data.tags).has('no-export')) return {};

      switch (childVersion.data.kind) {
        case KINDS.Content: {
          const state = getEditorState(childVersion.data.content);
          return { state, version: childVersion };
        }
        case KINDS.Output:
        case KINDS.Image: {
          const key = oxaLink('', childVersion.id);
          const version = childVersion as Version<Blocks.Image | Blocks.Output>;
          if (!key) return {};
          if (version.data.kind === KINDS.Output) {
            if (!outputHasImage(version as Version<Blocks.Output>)) return {};
          }
          const html = getFigureHTML(
            articleChild.id,
            key,
            childVersion.data.title,
            // Note: the caption is on the block!
            childBlock.data.caption ?? '',
            style,
          );
          const state = getEditorState(html);
          images[key] = version;
          return { state, version };
        }
        default:
          return {};
      }
    }),
  );

  // Load all images and references
  Object.entries(children).forEach(([, { state }]) => {
    if (!state) return;
    state.doc.descendants((node) => {
      switch (node.type.name) {
        case nodeNames.image: {
          const { src } = node.attrs as Nodes.Image.Attrs;
          const id = oxaLinkToId(src)?.block as VersionId;
          if (id) images[src] = new Version(session, id);
          return true;
        }
        case nodeNames.cite: {
          const { key, kind } = node.attrs as Nodes.Cite.Attrs;
          switch (kind) {
            case ReferenceKind.cite:
              if (key) referenceKeys.add(key);
              return true;
            case ReferenceKind.table:
            case ReferenceKind.eq:
            case ReferenceKind.sec:
            case ReferenceKind.code:
            case ReferenceKind.fig:
              // TODO: add a lookup table for reference IDs
              return true;
            default:
              return true;
          }
        }
        default:
          return true;
      }
    });
  });

  // Load all of the references
  await Promise.all(
    [...referenceKeys].map(async (key) => {
      const id = oxaLinkToId(key)?.block as VersionId;
      if (!id) return;
      // Always load the latest version for references!
      const { version } = await getLatestVersion<Blocks.Reference>(session, id, {
        format: ReferenceFormatTypes.bibtex,
      });
      if (version.data.kind !== KINDS.Reference) return;
      const { content } = version.data;
      // Extract the label: '@article{SimPEG2015,\n...' ➡️ 'SimPEG2015'
      const label = content.slice(content.indexOf('{') + 1, content.indexOf(','));
      references[key] = {
        label,
        bibtex: content,
        version,
      };
    }),
  );

  return {
    children,
    images,
    references,
  };
}

export async function loadImagesToBuffers(images: ArticleState['images']) {
  const buffers: Record<string, Buffer> = {};
  await Promise.all(
    Object.entries(images).map(async ([key, version]) => {
      await version.get();
      const { src } = getImageSrc(version);
      if (!src) return;
      const response = await fetch(src);
      const buffer = await response.buffer();
      buffers[key] = buffer;
    }),
  );
  return buffers;
}
