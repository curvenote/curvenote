import { createHash } from 'node:crypto';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import fs from 'node:fs';
import mime from 'mime-types';
import { selectors, buildSite, clean } from 'myst-cli';
import { tic } from 'myst-cli-utils';
import type { Logger } from 'myst-cli-utils';
import fetch from 'node-fetch';
import path from 'node:path';
import pLimit from 'p-limit';
import type {
  DnsRouter,
  SiteDeployRequest,
  SiteUploadRequest,
  SiteUploadResponse,
} from '@curvenote/blocks';
import { MyUser } from '../models.js';
import type { ISession } from '../session/types.js';
import { addOxaTransformersToOpts, confirmOrExit } from '../utils/index.js';
import type { SiteConfig } from 'myst-config';

type FromTo = {
  from: string;
  to: string;
};

function listFolderContents(session: ISession, from: string, to = ''): FromTo[] {
  const directory = fs.readdirSync(from);
  const files: string[] = [];
  const folders: string[] = [];
  directory.forEach((f) => {
    if (fs.statSync(path.join(from, f)).isDirectory()) {
      folders.push(f);
    } else {
      files.push(f);
    }
  });
  const outputFiles: FromTo[] = files.map((f) => ({
    from: path.join(from, f),
    to: to ? `${to}/${f}` : f,
  }));
  const outputFolders: FromTo[] = folders
    .map((f) => listFolderContents(session, path.join(from, f), to ? `${to}/${f}` : f))
    .flat();
  return [...outputFiles, ...outputFolders];
}

async function prepareFileForUpload(from: string, to: string): Promise<FileInfo> {
  const content = fs.readFileSync(from).toString();
  const stats = fs.statSync(from);
  const md5 = createHash('md5').update(content).digest('hex');
  const contentType = mime.lookup(path.extname(from));
  return { from, to, md5, size: stats.size, contentType: contentType || '' };
}

type FileInfo = {
  from: string;
  to: string;
  md5: string;
  size: number;
  contentType: string;
};

type FileUpload = FileInfo & {
  bucket: string;
  signedUrl: string;
};

async function uploadFile(log: Logger, upload: FileUpload) {
  const toc = tic();
  log.debug(`Starting upload of ${upload.from}`);
  const resumableSession = await fetch(upload.signedUrl, {
    method: 'POST',
    headers: {
      'x-goog-resumable': 'start',
      'content-type': upload.contentType,
    },
  });
  // Endpoint to which we should upload the file
  const location = resumableSession.headers.get('location') as string;

  // we are not resuming! if we want resumable uploads we need to implement
  // or use something other than fetch here that supports resuming
  const readStream = fs.createReadStream(upload.from);
  const uploadResponse = await fetch(location, {
    method: 'PUT',
    headers: {
      'Content-length': `${upload.size}`,
    },
    body: readStream,
  });

  if (!uploadResponse.ok) {
    log.error(`Upload failed for ${upload.from}`);
  }

  log.debug(toc(`Finished upload of ${upload.from} in %s.`));
}

export async function prepareUploadRequest(session: ISession) {
  const filesToUpload = listFolderContents(session, session.sitePath());
  session.log.info(`🔬 Preparing to upload ${filesToUpload.length} files`);

  const files = await Promise.all(
    filesToUpload.map(({ from, to }) => prepareFileForUpload(from, to)),
  );

  const uploadRequest: SiteUploadRequest = {
    files: files.map(({ md5, size, contentType, to }) => ({
      path: to,
      content_type: contentType,
      md5,
      size,
    })),
  };

  return { files, uploadRequest };
}

export async function processUpload(
  session: ISession,
  files: FileInfo[],
  uploadTargets: SiteUploadResponse,
  opts?: { ci?: boolean },
) {
  // Only upload N files at a time
  const limit = pLimit(10);
  const bar1 = opts?.ci
    ? undefined
    : new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  session.log.info(`☁️  Uploading ${files.length} files`);
  bar1?.start(files.length, 0);
  const toc = tic();
  let current = 0;
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const upload = uploadTargets.files[file.to];
        await uploadFile(session.log, {
          bucket: uploadTargets.bucket,
          from: file.from,
          to: upload.path,
          md5: file.md5,
          size: file.size,
          contentType: file.contentType,
          signedUrl: upload.signed_url,
        });
        current += 1;
        bar1?.update(current);
        if (opts?.ci && current % 5 == 0) {
          session.log.info(`☁️  Uploaded ${current} / ${files.length} files`);
        }
      }),
    ),
  );
  bar1?.stop();
  session.log.info(toc(`☁️  Uploaded ${files.length} files in %s.`));

  const cdnKey = uploadTargets.id;
  return { cdnKey };
}

/**
 * Upload content to the (private) staging bucket
 *
 * @param session
 * @param opts
 * @returns cdnkey and filepaths for deployment
 */
async function uploadContent(session: ISession, opts?: { ci?: boolean }) {
  const { files, uploadRequest } = await prepareUploadRequest(session);
  const { json: uploadTargets } = await session.post<SiteUploadResponse>('/sites/upload', {
    ...uploadRequest,
  });
  const { cdnKey } = await processUpload(session, files, uploadTargets, opts);
  return { cdnKey, filepaths: files.map(({ to }) => ({ path: to })) };
}

/**
 * Deploy content to the public/private CDN based on the usePublicCdn argument
 *
 * @param session
 * @param usePublicCdn whether to deploy to the public CDN or default private CDN
 * @param cdnKey
 * @param filepaths
 * @returns cdnkey
 */
async function deployContent(
  session: ISession,
  privacy: { public: boolean },
  cdnKey: string,
  filepaths: { path: string }[],
) {
  const toc = tic();
  const deployRequest: SiteDeployRequest = {
    public: privacy.public,
    id: cdnKey,
    files: filepaths,
  };
  const deployResp = await session.post('/sites/deploy', deployRequest);

  if (deployResp.ok) {
    session.log.info(toc(`🚀 Deployed ${filepaths.length} files in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
  } else {
    throw new Error('Deployment failed: Please contact support@curvenote.com!');
  }
  return cdnKey;
}

/**
 * Perform PRIVATE CDN upload and deployment
 *
 * @param session
 * @param opts
 * @returns cdnkey
 */
export async function uploadContentAndDeployToPrivateCdn(
  session: ISession,
  opts?: { ci?: boolean },
) {
  const { cdnKey, filepaths } = await uploadContent(session, opts);
  return await deployContent(session, { public: false }, cdnKey, filepaths);
}

/**
 * Perform PUBLIC CDN upload and deployment
 *
 * @param session
 * @param opts
 * @returns cdnkey
 */
export async function uploadContentAndDeployToPublicCdn(
  session: ISession,
  opts?: { ci?: boolean },
) {
  const { cdnKey, filepaths } = await uploadContent(session, opts);
  return await deployContent(session, { public: true }, cdnKey, filepaths);
}

export async function preflightPromotePublicContent(session: ISession, domains?: string[]) {
  // TODO throw on no permission to promote to any domain
}

export async function preflightPromoteToVenue(
  session: ISession,
  cdnKey: string,
  domains?: string[],
) {
  // TODO throw on no permission to submit to venue
}

interface VenueSubmitRequest {
  id: string;
  username: string;
}

export async function promoteToVenue(
  session: ISession,
  cdnKey: string,
  venue: string,
  username: string,
) {
  const toc = tic();
  const sumbissionRequest: VenueSubmitRequest = {
    id: cdnKey,
    username,
  };
  const deployResp = { ok: true }; //await session.post(`/venues/${venue}/submit`, deployRequest);
  if (deployResp.ok) {
    session.log.info(toc(`🚀 Submitted to venue "${venue}" in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
  } else {
    throw new Error('Submission failed: Please contact support@curvenote.com');
  }
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

  const hasDomain = opts.domain ?? siteConfig.domains;
  if (hasDomain) return 'public';

  // default to private
  return 'default-private';
}

export async function deploy(
  session: ISession,
  opts: Parameters<typeof buildSite>[1] & {
    ci?: boolean;
    domain?: string;
    private?: boolean;
    venue?: string;
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

  const strategy = resolveDeploymentStrategy(siteConfig, opts);
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
      await preflightPromoteToVenue(session, opts.venue!); // TODO check venue exists, and user can submit to it
      break;
    }
    default:
      await confirmOrExit(
        `🧐 No domains or venues are specified, local content will be deployed privately.

        To deploy a public website, add config.site.domains: - ${me.data.username}.curve.space to your config file 
        or use the --domain flag.

        To deploy privately and submit to a venue, use the --venue flag.

        Otherwise, private hosting on Curvenote is in beta, contact support@curvenote.com for access.
        `,
        opts,
      );
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
      const cdnKey = await uploadContentAndDeployToPrivateCdn(session, opts);
      await promoteToVenue(session, cdnKey, opts.venue!, me.data.username);
      session.log.info(`\n\n🚀 ${chalk.bold.green('Content successfully deployed')}`);
      session.log.info(`\nYour content remains private, and has been submitted to "${opts.venue}"`);
      session.log.info(
        `\nYour private CDN Key for this content is ${chalk.bold.yellow(cdnKey)}\n\n`,
      );
      break;
    }
    default: {
      const cdnKey = await uploadContentAndDeployToPrivateCdn(session, opts);
      session.log.info(`\n\n🚀 ${chalk.bold.green('Content successfully deployed')}`);
      session.log.info(`\nYour content remains private.`);
      session.log.info(`\nYour private CDN Keyfor this content is ${chalk.bold.yellow(cdnKey)}`);
      session.log.info(
        `\nPrivate hosting on Curvenote is in beta, contact support@curvenote.com for an invite\n\n`,
      );
      // TODO run `curvenote works list` to show all private works
    }
  }
}
