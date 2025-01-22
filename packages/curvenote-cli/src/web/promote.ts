import chalk from 'chalk';
import { selectors } from 'myst-cli';
import { tic } from 'myst-cli-utils';
import type { DnsRouter } from '@curvenote/blocks';
import type { ISession } from '../session/types.js';
import type { SiteConfig } from 'myst-config';

export async function promotePublicContent(session: ISession, cdnKey: string, domains?: string[]) {
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState()) as SiteConfig;
  if (!siteConfig) throw new Error('🧐 No site config found.');
  const toc = tic();
  const errorDomains: string[] = [];
  const useDomains = domains ?? siteConfig.domains;
  const sites = useDomains
    ? (
        await Promise.all(
          useDomains.map(async (domain) => {
            const resp = await session.post<DnsRouter>(`${session.config.editorApiUrl}/routers`, {
              cdn: cdnKey,
              domain,
            });
            if (resp.ok) return resp.json;
            errorDomains.push(`https://${domain}`);
            return null;
          }),
        )
      ).filter((s): s is DnsRouter => !!s)
    : [];

  if (errorDomains.length === 0)
    session.log.info(`\n\n${chalk.bold.green('🚀 Website successfully deployed')}`);

  const allSites = sites.map((s) => `https://${s.id}`).join('\n  - ');
  if (allSites.length > 0) {
    session.log.info(
      toc(
        `🌍 Site promoted to ${sites.length} domain${
          sites.length > 1 ? 's' : ''
        } in %s:\n  - ${allSites}`,
      ),
    );
  }
  session.log.info(
    '\n⚠️  https://curve.space is in beta. Please ensure you have a copy of your content locally.',
  );
  if (errorDomains.length > 0) {
    session.log.info(`\n\n${chalk.bold.red('⚠️ Could not deploy to some domains!')}`);
    throw Error(
      `Error promoting site(s): ${errorDomains.join(
        ', ',
      )}. Please ensure you have permission or contact support@curvenote.com`,
    );
  }
}
