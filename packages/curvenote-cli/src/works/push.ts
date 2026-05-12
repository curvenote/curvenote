import chalk from 'chalk';
import {
  exitOnInvalidKeyOption,
  getMyWorkFromKey,
  performCleanRebuild,
  promptForNewKey,
  uploadAndGetCdnKey,
  workKeyFromConfig,
  writeKeyToConfig,
} from './utils.js';
import type { WorkDTO } from '@curvenote/common';
import { tic } from 'myst-cli-utils';
import type { PushOpts, WorkPushLog } from './types.js';
import { addSourceToLogs } from '../logs/index.js';
import type { ISession } from '../session/types.js';
import { postToJournals, postToUrl } from '../utils/api.js';
import { writeJsonLogs } from 'myst-cli';

export async function postNewWork(
  session: ISession,
  cdnKey: string,
  cdn: string,
  key?: string,
  metadata?: {
    title?: string;
    description?: string;
    authors?: string[];
    author_details?: Record<string, any>[];
    doi?: string;
    date?: string;
    canonical?: boolean;
    contains?: string[];
    cdn?: string;
    cdn_key?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  },
): Promise<WorkDTO> {
  const toc = tic();

  session.log.debug(
    `POST to ${session.config?.apiUrl}/works with cdnKey: ${cdnKey}, cdn: ${cdn}${
      key ? `, key: ${key}` : ''
    }...`,
  );
  const body = {
    ...(cdnKey ? { cdn_key: cdnKey } : {}),
    ...(cdn ? { cdn } : {}),
    ...(key ? { key } : {}),
    ...(metadata ?? {}),
  };
  const resp = await postToJournals(session, '/works', body);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as WorkDTO;
    const { id, version_id } = json;
    session.log.info(toc(`🚀 Created a new work in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${id}`);
    session.log.debug(`Work Version Id: ${version_id}`);
    return json;
  } else {
    const message = ((await resp.json()) as { message?: string })?.message;
    throw new Error(`Posting new work failed${message ? `: ${message}` : ''}`);
  }
}

export async function postNewWorkVersion(
  session: ISession,
  versionsUrl: string,
  cdnKey: string,
  cdn: string,
  extra?: {
    metadata?: Record<string, any>;
    tags?: string[];
  },
): Promise<WorkDTO> {
  const toc = tic();

  session.log.debug(`POST to ${versionsUrl} with cdnKey: ${cdnKey} and cdn: ${cdn}...`);
  const resp = await postToUrl(session, `${versionsUrl}`, {
    cdn_key: cdnKey,
    cdn,
    contains: ['myst'],
    ...(extra?.metadata ? { metadata: extra.metadata } : {}),
    ...(extra?.tags && extra.tags.length > 0 ? { tags: extra.tags } : {}),
  });
  session.log.debug(`${resp.status} ${resp.statusText}`);

  if (resp.ok) {
    const json = (await resp.json()) as WorkDTO;
    const { id, version_id } = json;
    session.log.info(toc(`🚀 Created a new work version in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${id}`);
    session.log.debug(`Work Version Id: ${version_id}`);
    return json;
  } else {
    throw new Error('Posting new version of the work failed');
  }
}

export async function postNewWorkVersionFromMetadata(
  session: ISession,
  versionsUrl: string,
  metadata: {
    title?: string;
    description?: string;
    authors?: string[];
    author_details?: Record<string, any>[];
    doi?: string;
    date?: string;
    canonical?: boolean;
    metadata?: Record<string, any>;
    contains?: string[];
    cdn?: string;
    cdn_key?: string;
    tags?: string[];
  },
): Promise<WorkDTO> {
  const toc = tic();
  session.log.debug(`POST to ${versionsUrl} with metadata-only work version...`);
  const resp = await postToUrl(session, `${versionsUrl}`, metadata);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as WorkDTO;
    const { id, version_id } = json;
    session.log.info(toc(`🚀 Created a new work version in %s.`));
    session.log.debug(`Work Id: ${id}`);
    session.log.debug(`Work Version Id: ${version_id}`);
    return json;
  }
  throw new Error('Posting new version of the work failed');
}

/**
 * Push a new work or new version of work based on myst contents in a folder
 *
 * This will:
 * - Check for project.id (work key) and add it if missing
 * - Upload content to CDN
 * - Check if work exists and if not, create new work
 * - Create new version of work
 */
export async function push(session: ISession, opts?: PushOpts) {
  const pushLog: WorkPushLog = {
    input: {
      opts,
    },
  };
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }
  let inputKey = workKeyFromConfig(session);
  if (!inputKey) {
    inputKey = await promptForNewKey(session, opts);
    await writeKeyToConfig(session, inputKey);
  }
  exitOnInvalidKeyOption(session, inputKey);
  const key = inputKey;
  pushLog.key = key;
  if (opts?.public) {
    session.log.info(chalk.yellowBright(`🌍 You are pushing this work ${chalk.bold('publicly')}`));
  }
  session.log.info(
    `📍 Pushing ${opts?.public ? 'public' : 'private'} work using key: ${chalk.bold(key)}`,
  );

  await addSourceToLogs(pushLog);
  try {
    await performCleanRebuild(session, opts);
    const cdn = opts?.public ? session.config.publicCdnUrl : session.config.privateCdnUrl;
    const cdnKey = await uploadAndGetCdnKey(session, cdn, opts);

    const tags = opts?.tags && opts.tags.length > 0 ? opts.tags : undefined;
    const workResp = await getMyWorkFromKey(session, key);
    let work: WorkDTO;
    if (workResp) {
      session.log.debug(`posting new work version...`);
      work = await postNewWorkVersion(session, workResp.links.versions, cdnKey, cdn, { tags });
      session.log.debug(`new work posted with version id ${work.version_id}`);
    } else {
      session.log.debug(`posting new work...`);
      work = await postNewWork(session, cdnKey, cdn, key, tags ? { tags } : undefined);
      session.log.debug(`new work posted with id ${work.id}`);
    }
    if (!work.version_id) {
      throw new Error('Failed to create a work version');
    }
    pushLog.work = {
      id: work.id,
      date_created: workResp?.date_created ?? work.date_created,
    };
    pushLog.workVersion = {
      id: work.version_id,
      date_created: work.date_created,
    };
    session.log.info(
      chalk.bold.green(
        `📄 ${opts?.public ? 'Public' : 'Private'} work ${
          workResp ? 'updated' : 'created'
        } for key ${key}!`,
      ),
    );
    writeJsonLogs(session, 'curvenote.push.json', pushLog);
  } catch (err: any) {
    session.log.error(`📣 ${chalk.bold.red(err.message)}`);
    session.log.info('📨 Please contact support@curvenote.com');
    writeJsonLogs(session, 'curvenote.push.json', pushLog);
    process.exit(1);
  }
}
