import { selectors, buildSite, clean } from 'myst-cli';
import { MyUser } from '../models.js';
import type { ISession } from '../session/types.js';
import { addOxaTransformersToOpts, confirmOrExit } from '../utils/index.js';
import { promotePublicContent } from './promote.js';
import { uploadAndGetCdnKey } from '../works/utils.js';

export async function deploy(
  session: ISession,
  opts: Parameters<typeof buildSite>[1] & {
    ci?: boolean;
    domain?: string;
    venue?: string;
    forcePublic?: boolean; // not used in CLI, programmatic only
    resume?: boolean;
    yes?: boolean;
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

  const cdnKey = await uploadAndGetCdnKey(session, session.config.deploymentCdnUrl, opts);

  await promotePublicContent(session, cdnKey, domains);
}
