import { ISession } from '../../session/types';
import { links, warnings } from './reducers';
import type { ExternalLinkResult, WarningKind } from './types';
import { selectLinkStatus } from './selectors';
import fetch from 'node-fetch';

// These limit access from command line tools by default
const skippedDomains = ['www.linkedin.com', 'linkedin.com', 'medium.com', 'twitter.com'];

export async function checkLink(session: ISession, url: string): Promise<ExternalLinkResult> {
  const cached = selectLinkStatus(session.store.getState(), url);
  if (cached) return cached;
  const link: ExternalLinkResult = {
    url,
  };
  if (url.startsWith('mailto:')) {
    link.skipped = true;
    session.log.debug(`Skipping: ${url}`);
    session.store.dispatch(links.actions.updateLink(link));
    return link;
  }
  try {
    const parsedUrl = new URL(url);
    if (skippedDomains.includes(parsedUrl.hostname)) {
      link.skipped = true;
      session.log.debug(`Skipping: ${url}`);
      session.store.dispatch(links.actions.updateLink(link));
      return link;
    }
    session.log.debug(`Checking that "${url}" exists`);
    const resp = await fetch(url);
    link.ok = resp.ok;
    link.status = resp.status;
    link.statusText = resp.statusText;
  } catch (error) {
    session.log.debug(`\n\n${(error as Error)?.stack}\n\n`);
    session.log.debug(`Error fetching ${url} ${(error as Error).message}`);
    link.ok = false;
  }
  session.store.dispatch(links.actions.updateLink(link));
  return link;
}

export function addWarningForFile(
  session: ISession,
  file: string,
  message: string,
  kind: WarningKind = 'warn',
) {
  switch (kind) {
    case 'info':
      session.log.info(`ℹ️ ${file}: ${message}`);
      break;
    case 'error':
      session.log.error(`⛔️ ${file}: ${message}`);
      break;
    case 'warn':
    default:
      session.log.warn(`⚠️  ${file}: ${message}`);
      break;
  }
  session.store.dispatch(warnings.actions.addWarning({ file, message, kind }));
}
