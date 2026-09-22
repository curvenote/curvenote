import type { DepositIssue } from '../../backend/deposit/types.js';

const RANK = { blocking: 0, warning: 1 } as const;

/** Blocking first; stable within a severity so the mapper's order (title, date, authors...) is kept. */
export function sortIssues(issues: DepositIssue[]): DepositIssue[] {
  return [...issues].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

export function isReady(issues: DepositIssue[]): boolean {
  return !issues.some((issue) => issue.severity === 'blocking');
}

export function previewFileName(submissionId: string): string {
  return `${submissionId}.deposit-preview.xml`;
}

/** The XML is already in the page data, so the download needs no server route. */
export function xmlDataUrl(xml: string): string {
  return `data:application/xml;charset=utf-8,${encodeURIComponent(xml)}`;
}
