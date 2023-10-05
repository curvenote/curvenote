import chalk from 'chalk';
import { selectors, buildSite, clean } from 'myst-cli';
import { tic } from 'myst-cli-utils';
import type { DnsRouter } from '@curvenote/blocks';
import { MyUser } from '../models.js';
import type { ISession } from '../session/types.js';
import {
  addOxaTransformersToOpts,
  confirmOrExit,
  uploadContentAndDeployToPrivateCdn,
  uploadContentAndDeployToPublicCdn,
} from '../utils/index.js';
import type { SiteConfig } from 'myst-config';
import { postNewWork, submitToVenue } from '../works/utils.js';

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
  const me = await new MyUser(session).get();
  // determine how to deploy based on config and options
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }

  const strategy = opts.forcePublic ? 'public' : resolveDeploymentStrategy(siteConfig, opts);
  const domains = opts.domain ? [opts.domain] : siteConfig?.domains;

  // do confirmation for all strategies up-front
  // TODO check upload and promotion authorisations up front
  switch (strategy) {
    // TODO public-venue?
    case 'public': {
      if (!domains || domains.length === 0) {
        throw new Error(`🚨 Internal Error: No domains specified during public deployment`);
      }
      await confirmOrExit(
        `Deploy local content to "${domains.map((d) => `https://${d}`).join('", "')}"?`,
        opts,
      );
      await preflightPromotePublicContent(session, domains); // TODO check domains exist, and user can promote to them
      break;
    }
    case 'private-venue': {
      if (!opts.venue)
        throw new Error(`🚨 Internal Error: No value specified during venue deployment`);
      await confirmOrExit(`Deploy local content privately and submit to "${opts.venue}"?`, opts);
      // TODO check for venue (site)
      await preflightPromoteToVenue(session, opts.venue); // TODO check venue exists, and user can submit to it
      break;
    }
    default: {
      session.log.info(
        `${chalk.bold(
          '🧐 No domains or venues are specified, local content will be deployed privately.',
        )}`,
      );
      session.log.info(`
To deploy a public website, add config.site.domains: - ${
        me.data.username
      }.curve.space to your config file or use the --domain flag.

To deploy privately ${chalk.bold('and')} submit to a venue, use the ${chalk.bold('--venue')} flag.
        
Otherwise, private hosting on Curvenote is in beta, contact support@curvenote.com for an invite!
        `);
      await confirmOrExit(`Continue with private deployment?`, opts);
    }
  }

  // carry out common cleaning and building
  session.log.info('\n\n\t✨✨✨  Deploying Content to Curvenote  ✨✨✨\n\n');
  // clean the site folder, otherwise downloadable files will accumulate
  await clean(session, [], { site: true, yes: true });
  // Build the files in the content folder and process them
  await buildSite(session, addOxaTransformersToOpts(session, opts));

  switch (strategy) {
    case 'public': {
      const cdnKey = await uploadContentAndDeployToPublicCdn(session, opts);
      await promotePublicContent(session, cdnKey, domains);
      break;
    }
    case 'private-venue': {
      if (!opts.venue)
        throw new Error(`🚨 Internal Error: No venue specified in 'private-venue' deployment`);
      const cdnKey = await uploadContentAndDeployToPrivateCdn(session, opts);
      // TODO switch to private cdn once journals API can access it
      // const cdn = `https://prv.curvenote.com`;
      const cdn = `https://cdn.curvenote.com`;
      const { workId, workVersionId } = await postNewWork(session, cdnKey, cdn);
      // TODO check for venue (site)
      // TODO ask for kinds that the venue accepts
      const kind = 'project'; // TODO only woorks for tellus!!
      const { submissionId } = await submitToVenue(session, opts.venue, workVersionId, kind);
      session.log.info(`\n\n🚀 ${chalk.bold.green('Content successfully deployed')}.`);
      session.log.info(
        `\nYour content remains private, and has been submitted to "${opts.venue}".`,
      );
      session.log.info(`\nYour private CDN Key for this content is ${chalk.bold.yellow(cdnKey)}`);
      session.log.info(`The Work Id is ${chalk.bold.yellow(workId)}`);
      session.log.info(`The Submission Id is ${chalk.bold.yellow(submissionId)}\n\n`);
      break;
    }
    default: {
      const cdnKey = await uploadContentAndDeployToPrivateCdn(session, opts);
      session.log.info(`\n\n🚀 ${chalk.bold.green('Content successfully deployed.')}`);
      session.log.info(`\nYour content remains private.`);
      session.log.info(
        `\nYour private CDN Keyfor this content is ${chalk.bold.yellow(cdnKey)}\n\n`,
      );

      session.log.info(
        `\nPrivate hosting on Curvenote is in beta, contact support@curvenote.com for an invite!\n`,
      );
      // TODO run `curvenote works list` to show all private works
    }
  }
}
