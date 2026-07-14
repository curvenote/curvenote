/**
 * Shared AST helpers for document preview (text truncation, plain-text extraction).
 * Kept separate so pdfFirstPagePreview can import without circular dependency on fetchPreviews.
 */

import type { OfficeParserAST, OfficeContentNode } from 'officeparser';

/** A first page with this much text is enough for metadata extraction on its own. */
export const FIRST_PAGE_MIN_TEXT_LENGTH = 500;

/** Page two must be this much larger than a sparse first page before we include it. */
const SECOND_PAGE_SIGNIFICANTLY_LARGER_RATIO = 1.5;

/**
 * Target amount of extractable text (chars) to collect for non-paged ASTs (e.g. DOCX).
 */
export const FIRST_PAGE_TARGET_TEXT_LENGTH = 4000;

/** Hard ceiling on top-level nodes for non-paged AST truncation. */
export const FIRST_PAGE_MAX_CONTENT_NODES = 40;

/** First-page AST (text/content only — no base64 attachments). */
export interface PreviewAstData {
  type: OfficeParserAST['type'];
  metadata: OfficeParserAST['metadata'];
  content: OfficeContentNode[];
  wasTruncated: boolean;
}

function nodeToPlainText(node: OfficeContentNode): string {
  if (node.type === 'text') {
    return (node as { text?: string }).text ?? '';
  }
  if (node.type === 'image' || node.type === 'chart' || node.type === 'drawing') {
    return '';
  }
  const children = (node as { children?: OfficeContentNode[] }).children;
  if (!children?.length) {
    const direct = (node as { text?: string }).text;
    return direct != null ? String(direct) : '';
  }
  return children.map(nodeToPlainText).join('');
}

function extractableTextLength(nodes: OfficeContentNode[]): number {
  return astContentToPlainText(nodes).length;
}

function isPageNode(node: OfficeContentNode): boolean {
  return node.type === 'page';
}

export function shouldIncludeSecondPage(
  firstPage: OfficeContentNode,
  secondPage?: OfficeContentNode,
): boolean {
  if (!secondPage) return false;
  const firstPageLength = extractableTextLength([firstPage]);
  if (firstPageLength >= FIRST_PAGE_MIN_TEXT_LENGTH) return false;
  const secondPageLength = extractableTextLength([secondPage]);
  if (secondPageLength === 0) return false;
  return (
    secondPageLength >=
    Math.max(FIRST_PAGE_MIN_TEXT_LENGTH, firstPageLength * SECOND_PAGE_SIGNIFICANTLY_LARGER_RATIO)
  );
}

function selectFirstPageContentByBudget(fullContent: OfficeContentNode[]): OfficeContentNode[] {
  let textLength = 0;
  let count = 0;
  for (; count < fullContent.length; count += 1) {
    if (count >= FIRST_PAGE_MAX_CONTENT_NODES) break;
    textLength += extractableTextLength([fullContent[count]]);
    if (textLength >= FIRST_PAGE_TARGET_TEXT_LENGTH) {
      count += 1;
      break;
    }
  }
  return fullContent.slice(0, count);
}

export function truncateAstToFirstPage(ast: OfficeParserAST): PreviewAstData {
  const fullContent = ast.content ?? [];
  const pageNodes = fullContent.filter(isPageNode);
  const usePages = pageNodes.length > 0;
  const content = usePages
    ? pageNodes.slice(0, shouldIncludeSecondPage(pageNodes[0], pageNodes[1]) ? 2 : 1)
    : selectFirstPageContentByBudget(fullContent);
  const wasTruncated = usePages
    ? content.length < pageNodes.length
    : content.length < fullContent.length;
  return {
    type: ast.type,
    metadata: ast.metadata,
    content,
    wasTruncated,
  };
}

export function astContentToPlainText(content: OfficeContentNode[]): string {
  const parts = content.map((node) => {
    const text = nodeToPlainText(node);
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'list') {
      return text ? `${text}\n` : '\n';
    }
    if (node.type === 'table') {
      const children = (node as { children?: OfficeContentNode[] }).children ?? [];
      const rowTexts = children
        .filter((c) => (c as { type?: string }).type === 'row')
        .map((row) => {
          const cells = (row as { children?: OfficeContentNode[] }).children ?? [];
          return cells
            .map((c) => nodeToPlainText(c as OfficeContentNode))
            .filter(Boolean)
            .join('\t');
        });
      return rowTexts.join('\n') + '\n';
    }
    return text;
  });
  return parts.join('').trim();
}

export function emptyPreviewAst(sourcePath: string): PreviewAstData {
  const type: OfficeParserAST['type'] = sourcePath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
  return { type, metadata: {} as OfficeParserAST['metadata'], content: [], wasTruncated: false };
}
