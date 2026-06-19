// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { OfficeContentNode, OfficeParserAST } from 'officeparser';
import { astContentToPlainText, truncateAstToFirstPage } from './fetchPreviews.server';

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

  it('falls back to top-level node truncation when the AST has no page nodes', () => {
    const content = Array.from({ length: 12 }, (_, index) => paragraph(`Paragraph ${index}`));

    const result = truncateAstToFirstPage(ast(content));

    expect(result.content).toHaveLength(10);
    expect(result.wasTruncated).toBe(true);
  });
});
