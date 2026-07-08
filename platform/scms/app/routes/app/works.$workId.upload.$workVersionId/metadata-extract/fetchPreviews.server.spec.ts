// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { OfficeContentNode, OfficeParserAST } from 'officeparser';
import {
  astContentToPlainText,
  resolvePreviewImagePresence,
  truncateAstToFirstPage,
} from './fetchPreviews.server';

function textNode(text: string): OfficeContentNode {
  return { type: 'text', text } as OfficeContentNode;
}

function paragraph(text: string): OfficeContentNode {
  return {
    type: 'paragraph',
    children: [textNode(text)],
  } as OfficeContentNode;
}

function page(text: string): OfficeContentNode {
  return {
    type: 'page',
    children: [paragraph(text)],
  } as OfficeContentNode;
}

function ast(content: OfficeContentNode[]): OfficeParserAST {
  return {
    type: 'pdf',
    metadata: {},
    content,
    attachments: [],
  } as unknown as OfficeParserAST;
}

describe('fetch preview truncation', () => {
  it('keeps only the first page when it has enough extractable text', () => {
    const denseFirstPage = page('A'.repeat(600));
    const secondPage = page('B'.repeat(1200));

    const result = truncateAstToFirstPage(ast([denseFirstPage, secondPage]));

    expect(result.content).toEqual([denseFirstPage]);
    expect(result.wasTruncated).toBe(true);
    expect(astContentToPlainText(result.content)).toHaveLength(600);
  });

  it('includes the second page when the first page is sparse and page two is substantially larger', () => {
    const sparseFirstPage = page('A'.repeat(120));
    const largerSecondPage = page('B'.repeat(700));
    const thirdPage = page('C'.repeat(700));

    const result = truncateAstToFirstPage(ast([sparseFirstPage, largerSecondPage, thirdPage]));

    expect(result.content).toEqual([sparseFirstPage, largerSecondPage]);
    expect(result.wasTruncated).toBe(true);
    expect(astContentToPlainText(result.content)).toHaveLength(820);
  });

  it('collects non-paged content up to the character budget, including the crossing node', () => {
    // 5 × 1000-char paragraphs; the 4th crosses the 4000-char budget.
    const content = Array.from({ length: 5 }, () => paragraph('A'.repeat(1000)));

    const result = truncateAstToFirstPage(ast(content));

    expect(result.content).toHaveLength(4);
    expect(result.wasTruncated).toBe(true);
  });

  it('keeps all non-paged content when it is under the character budget', () => {
    const content = Array.from({ length: 6 }, () => paragraph('A'.repeat(100)));

    const result = truncateAstToFirstPage(ast(content));

    expect(result.content).toHaveLength(6);
    expect(result.wasTruncated).toBe(false);
  });

  it('does not let empty nodes consume the character budget', () => {
    // Many blank paragraphs before the real content: they add no text, so the content
    // node is still reached and included rather than being truncated away.
    const emptyLead = Array.from({ length: 12 }, () => paragraph(''));
    const content = [...emptyLead, paragraph('A'.repeat(4000))];

    const result = truncateAstToFirstPage(ast(content));

    expect(result.content).toHaveLength(content.length);
    expect(result.wasTruncated).toBe(false);
    expect(astContentToPlainText(result.content)).toHaveLength(4000);
  });

  it('caps non-paged content at the node ceiling when the budget is never reached', () => {
    // 50 tiny single-char paragraphs never reach the 4000-char budget, so the 40-node
    // ceiling bounds the slice.
    const content = Array.from({ length: 50 }, () => paragraph('A'));

    const result = truncateAstToFirstPage(ast(content));

    expect(result.content).toHaveLength(40);
    expect(result.wasTruncated).toBe(true);
  });
});

describe('resolvePreviewImagePresence', () => {
  it('returns present when any reliable preview has figures', () => {
    expect(
      resolvePreviewImagePresence(
        ['a.pdf'],
        [{ path: 'a.pdf', figures: [{ key: 'figure.webp' }] }],
      ),
    ).toBe('present');
  });

  it('returns absent when all preview candidates had figure extraction with no figures', () => {
    expect(
      resolvePreviewImagePresence(
        ['a.pdf'],
        [{ path: 'a.pdf', figures: [], figuresExtractionSkipped: false }],
      ),
    ).toBe('absent');
  });

  it('returns unknown when preview generation is incomplete or unavailable', () => {
    expect(resolvePreviewImagePresence([], [])).toBe('unknown');
    expect(resolvePreviewImagePresence(['a.pdf'], [])).toBe('unknown');
    expect(
      resolvePreviewImagePresence(
        ['a.pdf'],
        [{ path: 'a.pdf', figures: [], previewUnavailable: true }],
      ),
    ).toBe('unknown');
  });

  it('returns unknown when figure extraction was skipped', () => {
    expect(
      resolvePreviewImagePresence(
        ['a.pdf'],
        [{ path: 'a.pdf', figures: [], figuresExtractionSkipped: true }],
      ),
    ).toBe('unknown');
  });

  it('returns unknown for legacy cached previews with empty figures and no extraction flag', () => {
    expect(resolvePreviewImagePresence(['a.pdf'], [{ path: 'a.pdf', figures: [] }])).toBe(
      'unknown',
    );
  });
});
