import React, { useMemo, useState } from 'react';
import type {
  OfficeContentNode,
  ListMetadata,
  HeadingMetadata,
  CellMetadata,
  ImageMetadata,
  TextFormatting,
} from 'officeparser';
import { CodeXml } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { DocumentPreviewItem, PreviewFigure } from './fetchPreviews.server';

/** First-page AST from server (type, metadata, content; no base64 attachments) */
type PreviewAst = DocumentPreviewItem['ast'];

/** Map of attachment name -> signed thumbnail URL, used to resolve inline image nodes. */
type FigureUrlByName = Map<string, string>;

function buildFigureUrlByName(figures: PreviewFigure[]): FigureUrlByName {
  const map: FigureUrlByName = new Map();
  for (const fig of figures) {
    if (fig.name && fig.signedUrl) map.set(fig.name, fig.signedUrl);
  }
  return map;
}

/** Document metadata for style resolution (formatting + styleMap) */
type PartialFormatting = Partial<TextFormatting>;
type StyleMapEntry = { formatting?: PartialFormatting } | PartialFormatting;
type DocMetadata = PreviewAst['metadata'] & {
  formatting?: PartialFormatting;
  styleMap?: Record<string, StyleMapEntry>;
};
function getStyleFormatting(
  meta: DocMetadata | undefined,
  styleName: string | undefined,
): PartialFormatting | undefined {
  if (!meta?.styleMap || !styleName) return undefined;
  const entry = meta.styleMap[styleName];
  if (!entry) return undefined;
  return typeof (entry as { formatting?: unknown }).formatting === 'object'
    ? (entry as { formatting: PartialFormatting }).formatting
    : (entry as PartialFormatting);
}
function resolveFormatting(
  docMeta: DocMetadata | undefined,
  nodeStyle: string | undefined,
  nodeFormatting?: TextFormatting,
): TextFormatting {
  const defaultF = docMeta?.formatting ?? {};
  const styleF = getStyleFormatting(docMeta, nodeStyle) ?? {};
  const nodeF = nodeFormatting ?? {};
  return { ...defaultF, ...styleF, ...nodeF } as TextFormatting;
}

interface DocumentPreviewerProps {
  previews: DocumentPreviewItem[];
  /** Controlled active tab value (file index as string, or ALL_FIGURES_TAB). */
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
}

type ListGroup = {
  type: 'listGroup';
  listType: 'ordered' | 'unordered';
  items: OfficeContentNode[];
};

/** Group consecutive list nodes so we can wrap them in a single <ul> or <ol> */
function groupContentNodes(nodes: OfficeContentNode[]): Array<OfficeContentNode | ListGroup> {
  const result: Array<OfficeContentNode | ListGroup> = [];
  let listBuffer: OfficeContentNode[] = [];
  let listType: 'ordered' | 'unordered' = 'unordered';

  for (const node of nodes) {
    if (node.type === 'list') {
      const meta = node.metadata as ListMetadata | undefined;
      const currentListType = meta?.listType ?? 'unordered';
      if (listBuffer.length > 0 && currentListType !== listType) {
        result.push({ type: 'listGroup', listType, items: listBuffer });
        listBuffer = [];
      }
      listType = currentListType;
      listBuffer.push(node);
    } else {
      if (listBuffer.length > 0) {
        result.push({ type: 'listGroup', listType, items: listBuffer });
        listBuffer = [];
      }
      result.push(node);
    }
  }
  if (listBuffer.length > 0) {
    result.push({ type: 'listGroup', listType, items: listBuffer });
  }
  return result;
}

interface AstNodeProps {
  node: OfficeContentNode;
  figureUrlByName: FigureUrlByName;
  docMeta?: DocMetadata;
}

function AstNode({ node, figureUrlByName, docMeta }: AstNodeProps): React.ReactElement {
  const nodeStyleName = (node.metadata as { style?: string } | undefined)?.style;
  const effectiveFormatting = resolveFormatting(docMeta, nodeStyleName, node.formatting);

  const renderChildren = () =>
    node.children?.map((child: OfficeContentNode, i: number) => (
      <AstNode key={i} node={child} figureUrlByName={figureUrlByName} docMeta={docMeta} />
    ));

  const formatStyle = (f?: TextFormatting): React.CSSProperties => {
    if (!f) return {};
    const style: React.CSSProperties = {};
    if (f.color) style.color = f.color;
    if (f.backgroundColor) style.backgroundColor = f.backgroundColor;
    if (f.font) style.fontFamily = f.font;
    if (f.size) style.fontSize = f.size;
    if (f.alignment) style.textAlign = f.alignment;
    return style;
  };

  const wrapWithFormatting = (content: React.ReactNode, f?: TextFormatting) => {
    if (!f) return content;
    let out: React.ReactNode = content;
    if (f.bold) out = <strong>{out}</strong>;
    if (f.italic) out = <em>{out}</em>;
    if (f.underline) out = <u>{out}</u>;
    if (f.strikethrough) out = <s>{out}</s>;
    if (f.subscript) out = <sub>{out}</sub>;
    if (f.superscript) out = <sup>{out}</sup>;
    const style = formatStyle(f);
    if (Object.keys(style).length > 0) out = <span style={style}>{out}</span>;
    return out;
  };

  switch (node.type) {
    case 'text':
      return <>{wrapWithFormatting(node.text ?? '', effectiveFormatting)}</>;
    case 'paragraph':
      return (
        <p className="mb-4 last:mb-0" style={formatStyle(effectiveFormatting)}>
          {renderChildren()}
        </p>
      );
    case 'heading': {
      const meta = node.metadata as HeadingMetadata | undefined;
      const level = Math.min(6, Math.max(1, meta?.level ?? 1));
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag className="mt-4 mb-2 first:mt-0" style={formatStyle(effectiveFormatting)}>
          {renderChildren()}
        </Tag>
      );
    }
    case 'table':
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', margin: '0.5em 0' }}>
          <tbody>{renderChildren()}</tbody>
        </table>
      );
    case 'row':
      return <tr>{renderChildren()}</tr>;
    case 'cell': {
      const meta = node.metadata as CellMetadata | undefined;
      const attrs: React.TdHTMLAttributes<HTMLTableCellElement> = {
        style: { border: '1px solid #ccc', padding: '4px 8px', verticalAlign: 'top' },
      };
      if (meta?.rowSpan) attrs.rowSpan = meta.rowSpan;
      if (meta?.colSpan) attrs.colSpan = meta.colSpan;
      return <td {...attrs}>{renderChildren()}</td>;
    }
    case 'list':
      return <li>{renderChildren()}</li>;
    case 'image': {
      const meta = node.metadata as ImageMetadata | undefined;
      const name = meta?.attachmentName;
      const url = name ? figureUrlByName.get(name) : undefined;
      if (url) {
        return (
          <img src={url} alt={meta?.altText ?? ''} style={{ maxWidth: '100%', height: 'auto' }} />
        );
      }
      return <span className="docx-preview-image-placeholder">[Image: {name ?? 'unknown'}]</span>;
    }
    case 'chart':
      return <span className="docx-preview-chart-placeholder">[Chart]</span>;
    case 'drawing':
      return <span className="docx-preview-drawing-placeholder">[Drawing]</span>;
    case 'slide':
    case 'note':
    case 'sheet':
    case 'page':
      return <div className={`docx-preview-${node.type}`}>{renderChildren()}</div>;
    default:
      return <>{renderChildren()}</>;
  }
}

interface OfficeAstRendererProps {
  ast: PreviewAst;
  figureUrlByName: FigureUrlByName;
}

const PREVIEW_CONTENT_CLASS = 'docx-preview-content text-stone-900';

/**
 * White "paper" surface that bounds tab content (and the empty/busy/error states)
 * so it reads as lifted off the page. Forced white in dark mode to match the
 * document-preview aesthetic (dark text on paper).
 */
export const PREVIEW_SURFACE_CLASS =
  'rounded-lg border border-stone-200 bg-white p-4 text-stone-900 shadow-sm dark:border-stone-700 dark:bg-white';

/**
 * Tab content surface: capped at double the empty-state height (280px → 560px)
 * with vertical scrolling when the preview overflows.
 */
const PREVIEW_CONTENT_SURFACE_CLASS = `${PREVIEW_SURFACE_CLASS} max-h-[560px] overflow-y-auto`;

function OfficeAstRenderer({ ast, figureUrlByName }: OfficeAstRendererProps): React.ReactElement {
  const content = ast.content ?? [];
  const grouped = groupContentNodes(content);
  const docMeta = ast.metadata as DocMetadata | undefined;

  return (
    <div className={PREVIEW_CONTENT_CLASS} style={{ lineHeight: 1.6 }}>
      {grouped.map((item, i) => {
        if ('listType' in item && item.type === 'listGroup') {
          const ListTag = item.listType === 'ordered' ? 'ol' : 'ul';
          return (
            <ListTag key={i} className="my-3">
              {item.items.map((node: OfficeContentNode, j: number) => (
                <AstNode key={j} node={node} figureUrlByName={figureUrlByName} docMeta={docMeta} />
              ))}
            </ListTag>
          );
        }
        return (
          <AstNode
            key={i}
            node={item as OfficeContentNode}
            figureUrlByName={figureUrlByName}
            docMeta={docMeta}
          />
        );
      })}
    </div>
  );
}

function SingleFileView({
  item,
  showAst,
  onToggleAst,
}: {
  item: DocumentPreviewItem;
  showAst: boolean;
  onToggleAst: () => void;
}) {
  const figureUrlByName = useMemo(() => buildFigureUrlByName(item.figures), [item.figures]);
  return (
    <div className="relative w-full">
      <ui.Button
        type="button"
        variant={showAst ? 'secondary' : 'outline'}
        size="icon"
        className="absolute top-0 right-0 z-10 w-8 h-8"
        onClick={onToggleAst}
        title={showAst ? 'Show preview' : 'Show AST'}
      >
        <CodeXml className="w-4 h-4" />
      </ui.Button>
      <div className="pt-8">
        {showAst ? (
          <pre className="text-xs overflow-auto max-h-[400px] bg-stone-50 dark:bg-stone-900 p-3 rounded border border-stone-200 dark:border-stone-700">
            {JSON.stringify(item.ast, null, 2)}
          </pre>
        ) : item.previewUnavailable ? (
          <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-stone-300 px-6 py-8 text-center text-sm text-muted-foreground">
            Preview unavailable for this file (it may be too large). You can still pick a thumbnail
            from other files or upload one manually.
          </div>
        ) : (
          <div className="overflow-hidden relative" style={{ whiteSpace: 'pre-wrap' }}>
            <OfficeAstRenderer ast={item.ast} figureUrlByName={figureUrlByName} />
            {item.ast.wasTruncated === true && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[100px] pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.7) 40%, rgba(255, 255, 255, 1) 70%)',
                }}
                aria-hidden
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ALL_FIGURES_TAB = 'all-figures';

const PREVIEW_TAB_TITLE_MAX = 20;

function shortenPreviewTabTitle(name: string, max = PREVIEW_TAB_TITLE_MAX): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1).trimEnd()}…`;
}

/**
 * A single candidate figure with the file it came from.
 *
 * The figure's storage `key` is the stable locator: candidate figures are downscaled
 * and persisted to storage at parse time, so selection and materialisation deal purely
 * in storage paths.
 */
export type DocumentFigure = {
  figure: PreviewFigure;
  sourceName: string;
  sourcePath: string;
};

/** Collect all candidate figures across previews with their source file name. */
export function collectAllFigures(previews: DocumentPreviewItem[]): DocumentFigure[] {
  const out: DocumentFigure[] = [];
  for (const item of previews) {
    for (const figure of item.figures) {
      out.push({
        figure,
        sourceName: item.data.name ?? item.path,
        sourcePath: item.path,
      });
    }
  }
  return out;
}

function AllFiguresView({ figures }: { figures: DocumentFigure[] }) {
  if (figures.length === 0) {
    return (
      <div className={PREVIEW_CONTENT_CLASS}>
        <p className="text-sm text-muted-foreground">no figures found</p>
      </div>
    );
  }
  return (
    <div className={PREVIEW_CONTENT_CLASS}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {figures.map(({ figure, sourceName }) => {
          const label = figure.altText ?? figure.name ?? 'Figure';
          return (
            <figure key={figure.key} className="flex flex-col gap-1">
              <div className="flex overflow-hidden justify-center items-center min-h-0 rounded aspect-square bg-stone-100 dark:bg-stone-800">
                {figure.signedUrl ? (
                  <img
                    src={figure.signedUrl}
                    alt={label}
                    className="object-contain w-full h-full"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">[No data]</span>
                )}
              </div>
              <figcaption
                className="text-xs truncate text-muted-foreground"
                title={figure.altText ?? figure.name}
              >
                {label}
              </figcaption>
              <p className="text-xs truncate text-muted-foreground/80" title={sourceName}>
                {sourceName}
              </p>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

export const DocumentPreviewer = ({
  previews,
  activeTab,
  onActiveTabChange,
}: DocumentPreviewerProps) => {
  const [showAst, setShowAst] = useState(false);
  const [internalTab, setInternalTab] = useState('0');
  const fileTab = activeTab ?? internalTab;
  const setFileTab = onActiveTabChange ?? setInternalTab;

  const allFigures = collectAllFigures(previews);

  return (
    <ui.Tabs value={fileTab} onValueChange={setFileTab} className="w-full">
      <ui.TabsList className="justify-start p-0 w-full h-auto bg-transparent rounded-none border-0 border-b-2 shadow-none">
        {previews.map((item, index) => {
          const fileName = item.data.name ?? item.path;
          const tabTitle = shortenPreviewTabTitle(fileName);
          return (
            <ui.TabsTrigger
              key={item.path}
              value={String(index)}
              title={tabTitle !== fileName ? fileName : undefined}
              className="rounded-none border-b-2 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent shadow-none"
            >
              {tabTitle}
            </ui.TabsTrigger>
          );
        })}
        <ui.TabsTrigger
          value={ALL_FIGURES_TAB}
          className="rounded-none border-b-2 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent shadow-none"
        >
          All Figures
        </ui.TabsTrigger>
      </ui.TabsList>
      {previews.map((item, index) => (
        <ui.TabsContent
          key={item.path}
          value={String(index)}
          className="mt-4 rounded-none border-0 bg-transparent p-0"
        >
          <div className={PREVIEW_CONTENT_SURFACE_CLASS}>
            <SingleFileView
              item={item}
              showAst={showAst}
              onToggleAst={() => setShowAst((v) => !v)}
            />
          </div>
        </ui.TabsContent>
      ))}
      <ui.TabsContent
        value={ALL_FIGURES_TAB}
        className="mt-4 rounded-none border-0 bg-transparent p-0"
      >
        <div className={PREVIEW_CONTENT_SURFACE_CLASS}>
          <AllFiguresView figures={allFigures} />
        </div>
      </ui.TabsContent>
    </ui.Tabs>
  );
};
