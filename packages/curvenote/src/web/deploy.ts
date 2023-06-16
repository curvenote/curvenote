import { createHash } from 'node:crypto';
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
import { confirmOrExit } from '../utils/index.js';

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

export async function deployContentToCdn(session: ISession, opts?: { ci?: boolean }) {
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
  const { json: uploadTargets } = await session.post<SiteUploadResponse>(
    '/sites/upload',
    uploadRequest,
  );

  // Only upload N files at a time
  const limit = pLimit(10);
  const bar1 = opts?.ci
    ? undefined
    : new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  session.log.info(`☁️  Uploading ${files.length} files`);
  bar1?.start(files.length, 0);
  let current = 0;
  const toc = tic();
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

  const deployRequest: SiteDeployRequest = {
    id: cdnKey,
    files: files.map(({ to }) => ({ path: to })),
  };
  const deployResp = await session.post('/sites/deploy', deployRequest);

  if (deployResp.ok) {
    session.log.info(toc(`🚀 Deployed ${files.length} files in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
  } else {
    throw new Error('Deployment failed: Please contact support@curvenote.com!');
  }
  return cdnKey;
}

export async function promoteContent(session: ISession, cdnKey: string, domains?: string[]) {
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

  const allSites = sites.map((s) => `https://${s.id}`).join('\n  - ');
  if (allSites.length > 0) {
    session.log.info(
      toc(
        `🌍 Site promoted to ${sites.length} domain${
          sites.length > 1 ? 's' : ''
        } in %s:\n\n  - ${allSites}`,
      ),
    );
  }
  session.log.info(
    '\n\n⚠️  https://curve.space is in beta. Please ensure you have a copy of your content locally.',
  );
  if (errorDomains.length > 0) {
    throw Error(
      `Error promoting site(s): ${errorDomains.join(
        ', ',
      )}. Please ensure you have permission or contact support@curvenote.com`,
    );
  }
}

export async function deploy(
  session: ISession,
  opts: Parameters<typeof buildSite>[1] & { ci?: boolean; domain?: string },
): Promise<void> {
  if (session.isAnon) {
    throw new Error(
      '⚠️ You must be authenticated for this call. Use `curvenote token set [token]`',
    );
  }
  const me = await new MyUser(session).get();
  // Do a bit of prework to ensure that the domains exists in the config file
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }
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
  session.log.info('\n\n\t✨✨✨  Deploying Curvenote  ✨✨✨\n\n');
  // clean the site folder, otherwise downloadable files will accumulate
  await clean(session, [], { site: true, yes: true });
  // Build the files in the content folder and process them
  await buildSite(session, opts);
  const cdnKey = await deployContentToCdn(session, opts);
  await promoteContent(session, cdnKey, domains);
}
