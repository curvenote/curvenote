import React, { useState } from 'react';
import type {
  OfficeContentNode,
  OfficeAttachment,
  ListMetadata,
  HeadingMetadata,
  CellMetadata,
  ImageMetadata,
  TextFormatting,
} from 'officeparser';
import { CodeXml, FileText, Search } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { DocxPreviewItem } from './fetchPreviews.server';

/** First-page AST from server (type, metadata, content, attachments; no toText) */
type PreviewAst = DocxPreviewItem['ast'];

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

interface DocxPreviewerProps {
  previews: DocxPreviewItem[];
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

function getAttachmentByName(
  attachments: OfficeAttachment[],
  name: string,
): OfficeAttachment | undefined {
  return attachments.find((a) => a.name === name);
}

interface AstNodeProps {
  node: OfficeContentNode;
  attachments: OfficeAttachment[];
  docMeta?: DocMetadata;
}

function AstNode({ node, attachments, docMeta }: AstNodeProps): React.ReactElement {
  const nodeStyleName = (node.metadata as { style?: string } | undefined)?.style;
  const effectiveFormatting = resolveFormatting(docMeta, nodeStyleName, node.formatting);

  const renderChildren = () =>
    node.children?.map((child: OfficeContentNode, i: number) => (
      <AstNode key={i} node={child} attachments={attachments} docMeta={docMeta} />
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
      const attachment = name ? getAttachmentByName(attachments, name) : undefined;
      if (attachment?.data) {
        const src = `data:${attachment.mimeType};base64,${attachment.data}`;
        return (
          <img
            src={src}
            alt={meta?.altText ?? attachment.altText ?? ''}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
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
}

const PREVIEW_CONTENT_CLASS =
  'docx-preview-content bg-white dark:bg-white text-stone-900 rounded p-4';

function OfficeAstRenderer({ ast }: OfficeAstRendererProps): React.ReactElement {
  const content = ast.content ?? [];
  const grouped = groupContentNodes(content);
  const attachments: OfficeAttachment[] = ast.attachments ?? [];
  const docMeta = ast.metadata as DocMetadata | undefined;

  return (
    <div className={PREVIEW_CONTENT_CLASS} style={{ lineHeight: 1.6 }}>
      {grouped.map((item, i) => {
        if ('listType' in item && item.type === 'listGroup') {
          const ListTag = item.listType === 'ordered' ? 'ol' : 'ul';
          return (
            <ListTag key={i} className="my-3">
              {item.items.map((node: OfficeContentNode, j: number) => (
                <AstNode key={j} node={node} attachments={attachments} docMeta={docMeta} />
              ))}
            </ListTag>
          );
        }
        return (
          <AstNode
            key={i}
            node={item as OfficeContentNode}
            attachments={attachments}
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
  item: DocxPreviewItem;
  showAst: boolean;
  onToggleAst: () => void;
}) {
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
        ) : (
          <div className="relative overflow-hidden" style={{ whiteSpace: 'pre-wrap' }}>
            <OfficeAstRenderer ast={item.ast} />
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

const ALL_FIGURES_TAB = 'all-figures';

/** Collect all image attachments across previews with source file name */
function collectAllFigures(previews: DocxPreviewItem[]): { attachment: OfficeAttachment; sourceName: string }[] {
  const out: { attachment: OfficeAttachment; sourceName: string }[] = [];
  for (const item of previews) {
    const attachments = item.ast.attachments ?? [];
    for (const att of attachments) {
      if (att.type === 'image') {
        out.push({ attachment: att, sourceName: item.data.name ?? item.path });
      }
    }
  }
  return out;
}

function AllFiguresView({ figures }: { figures: { attachment: OfficeAttachment; sourceName: string }[] }) {
  if (figures.length === 0) {
    return (
      <div className={PREVIEW_CONTENT_CLASS}>
        <p className="text-sm text-muted-foreground">No figures in documents.</p>
      </div>
    );
  }
  return (
    <div className={PREVIEW_CONTENT_CLASS}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {figures.map(({ attachment, sourceName }, i) => {
          const src = attachment.data
            ? `data:${attachment.mimeType};base64,${attachment.data}`
            : undefined;
          return (
            <figure key={`${sourceName}-${attachment.name}-${i}`} className="flex flex-col gap-1">
              <div className="aspect-square bg-stone-100 dark:bg-stone-800 rounded overflow-hidden flex items-center justify-center min-h-0">
                {src ? (
                  <img
                    src={src}
                    alt={attachment.altText ?? attachment.name ?? ''}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">[No data]</span>
                )}
              </div>
              <figcaption className="text-xs text-muted-foreground truncate" title={attachment.altText ?? attachment.name}>
                {attachment.altText ?? attachment.name ?? 'Figure'}
              </figcaption>
              <p className="text-xs text-muted-foreground/80 truncate" title={sourceName}>
                {sourceName}
              </p>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

export const DocxPreviewer = ({ previews }: DocxPreviewerProps) => {
  const [showAst, setShowAst] = useState(false);
  const [fileTab, setFileTab] = useState('0');

  if (previews.length === 0) {
    return (
      <div className="w-full aspect-square min-h-[280px] rounded-md bg-white dark:bg-white flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex relative justify-center items-center">
          <FileText className="w-14 h-14" strokeWidth={1.25} />
          <Search className="absolute -right-1 -bottom-1 w-6 h-6 opacity-80" strokeWidth={2} />
        </div>
        <p className="text-sm">Previews will be shown here</p>
      </div>
    );
  }

  const allFigures = collectAllFigures(previews);
  const containerClass = 'rounded-md p-4 min-h-[100px] bg-white dark:bg-white';

  return (
    <div className={containerClass}>
      <ui.Tabs value={fileTab} onValueChange={setFileTab} className="w-full">
        <ui.TabsList className="justify-start p-0 w-full h-auto bg-transparent rounded-none border-0 border-b-2 shadow-none">
          {previews.map((item, index) => (
            <ui.TabsTrigger
              key={item.path}
              value={String(index)}
              className="rounded-none border-b-2 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent shadow-none"
            >
              {item.data.name}
            </ui.TabsTrigger>
          ))}
          <ui.TabsTrigger
            value={ALL_FIGURES_TAB}
            className="rounded-none border-b-2 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent shadow-none"
          >
            All Figures
          </ui.TabsTrigger>
        </ui.TabsList>
        {previews.map((item, index) => (
          <ui.TabsContent key={item.path} value={String(index)} className="mt-4">
            <SingleFileView
              item={item}
              showAst={showAst}
              onToggleAst={() => setShowAst((v) => !v)}
            />
          </ui.TabsContent>
        ))}
        <ui.TabsContent value={ALL_FIGURES_TAB} className="mt-4">
          <AllFiguresView figures={allFigures} />
        </ui.TabsContent>
      </ui.Tabs>
    </div>
  );
};
