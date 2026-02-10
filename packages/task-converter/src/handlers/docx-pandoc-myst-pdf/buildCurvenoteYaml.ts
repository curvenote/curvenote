/**
 * curvenote.yml project section augmented with work version info.
 */

import type { WorkVersionPayload } from '../../payload.js';

export function buildCurvenoteYaml(workVersion: WorkVersionPayload): string {
  const id = crypto.randomUUID();
  const title = workVersion.title ?? 'Untitled';
  const description = workVersion.description ?? '';
  const authors = Array.isArray(workVersion.authors) ? workVersion.authors : [];
  const authorsYaml = authors.length ? `\nauthors: ${JSON.stringify(authors)}` : '';
  return `version: 1
project:
  id: ${id}
  title: ${JSON.stringify(title)}
  description: ${JSON.stringify(description)}${authorsYaml}
site:
  title: ${JSON.stringify(title)}
`;
}
