import chalk from 'chalk';
import type { ISession } from '../session/types.js';
import type { SiteInitOpts } from './types.js';
import { checkVenueExists, ensureVenue } from './utils.js';
import type { SiteWithContentDTO } from '@curvenote/common';
import { postToJournals } from '../utils/api.js';
import { tic } from 'myst-cli-utils';
import { getWorkFromKey, workKeyFromConfig } from '../works/utils.js';

export async function patchSiteWithContent(
  session: ISession,
  siteName: string,
  content: string,
): Promise<SiteWithContentDTO> {
  const toc = tic();

  session.log.debug(
    `PATCH to ${session.config?.apiUrl}/sites/${siteName} with work content: ${content}...`,
  );
  const resp = await postToJournals(
    session,
    `/sites/${siteName}`,
    { content },
    { method: 'PATCH' },
  );
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SiteWithContentDTO;
    session.log.info(toc(`🔧 Updated Site landing content in %s.`));
    session.log.debug(`Site name: ${siteName}`);
    return json;
  } else {
    const message = ((await resp.json()) as { message?: string })?.message;
    throw new Error(`Patching Site failed${message ? `: ${message}` : ''}`);
  }
}

export async function init(session: ISession, name: string, opts?: SiteInitOpts) {
  if (!opts?.setContent) {
    session.log.error(`📣 ${chalk.bold.red('Cannot initialize new Site from CLI.')}`);
    session.log.info('📨 Please contact support@curvenote.com');
    process.exit(1);
  }
  name = await ensureVenue(session, name, { ...opts, action: 'set landing content' });
  await checkVenueExists(session, name);
  let content: string | undefined;
  const key = workKeyFromConfig(session);
  if (key) {
    const work = await getWorkFromKey(session, key);
    content = work?.id;
  }
  if (!content) {
    session.log.error(
      `📣 ${chalk.bold.red('Unable to find work; you may need to run "curvenote work push"')}`,
    );
    process.exit(1);
  }
  await patchSiteWithContent(session, name, content);
}
