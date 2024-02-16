import chalk from 'chalk';
import { selectors, buildSite, clean } from 'myst-cli';
import { tic } from 'myst-cli-utils';
import type { DnsRouter } from '@curvenote/blocks';
import { MyUser } from '../models.js';
import type { ISession } from '../session/types.js';
import {
  addOxaTransformersToOpts,
  confirmOrExit,
  uploadContentAndDeployToPublicCdn,
} from '../utils/index.js';
import type { SiteConfig } from 'myst-config';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function preflightPromotePublicContent(session: ISession, domains?: string[]) {
  // TODO throw on no permission to promote to any domain
}

export async function preflightPromoteToVenue(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  session: ISession,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cdnKey: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  domains?: string[],
) {
  // TODO throw on no permission to submit to venue
}

export async function promotePublicContent(session: ISession, cdnKey: string, domains?: string[]) {
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) throw new Error('🧐 No site config found.');
  const toc = tic();
  const errorDomains: string[] = [];
  const useDomains = domains ?? siteConfig.domains;
  const sites = useDomains
    ? (
        await Promise.all(
          useDomains.map(async (domain) => {
            const resp = await session.post<DnsRouter>('/routers', {
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

type DeploymentStrategy = 'public' | 'private-venue' | 'default-private';

/**
 * Determine how deployment should be done based on the options and site config
 *
 * @returns DeploymentStrategy
 */
export function resolveDeploymentStrategy(
  siteConfig: SiteConfig,
  opts: { domain?: string; venue?: string },
): DeploymentStrategy {
  // if a venue is specified, then it is private and takes precedence over domain
  if (opts.venue) return 'private-venue';

  const hasDomain = opts.domain !== undefined || (siteConfig.domains ?? []).length > 0;
  if (hasDomain) return 'public';

  // default to private
  return 'default-private';
}

export async function deploy(
  session: ISession,
  opts: Parameters<typeof buildSite>[1] & {
    ci?: boolean;
    domain?: string;
    venue?: string;
    forcePublic?: boolean; // not used in CLI, programmatic only
  },
): Promise<void> {
  if (session.isAnon) {
    throw new Error(
      '⚠️ You must be authenticated for this call. Use `curvenote token set [token]`',
    );
  }

  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }

  const me = await new MyUser(session).get();

  const domains = opts.domain ? [opts.domain] : siteConfig?.domains;
  if (!domains || domains.length === 0) {
    throw new Error(
      `🧐 No domains specified, use config.site.domains: - ${me.data.username}.curve.space`,
    );
  }
  await preflightPromotePublicContent(session, domains); // TODO check domains exist, and user can promote to them
  await confirmOrExit(
    `Deploy local content to "${domains.map((d) => `https://${d}`).join('", "')}"?`,
    opts,
  );

  // carry out common cleaning and building
  session.log.info('\n\n\t✨✨✨  Deploying Content to Curvenote  ✨✨✨\n\n');
  // clean the site folder, otherwise downloadable files will accumulate
  await clean(session, [], { site: true, yes: true });
  // Build the files in the content folder and process them
  await buildSite(session, addOxaTransformersToOpts(session, opts));

  const cdnKey = await uploadContentAndDeployToPublicCdn(session, opts);
  await promotePublicContent(session, cdnKey, domains);
}
