import chalk from 'chalk';
import {
  exitOnInvalidKeyOption,
  getWorkFromKey,
  performCleanRebuild,
  promptForNewKey,
  uploadAndGetCdnKey,
  workKeyFromConfig,
  writeKeyToConfig,
} from './utils.js';
import type { WorkDTO } from '@curvenote/common';
import { tic } from 'myst-cli-utils';
import type { BaseOpts } from '../logs/index.js';
import { addSourceToLogs } from '../logs/index.js';
import type { ISession } from '../session/types.js';
import type { WorkPushLog } from './types.js';
import { postToJournals, postToUrl } from '../utils/api.js';
import { writeJsonLogs } from 'myst-cli';

export async function postNewWork(
  session: ISession,
  cdnKey: string,
  cdn: string,
  key?: string,
): Promise<WorkDTO> {
  const toc = tic();

  session.log.debug(
    `POST to ${session.config?.apiUrl}/works with cdnKey: ${cdnKey}, cdn: ${cdn}${key ? `, key: ${key}` : ''}...`,
  );
  const resp = await postToJournals(session, '/works', { cdn_key: cdnKey, cdn, key });
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
): Promise<WorkDTO> {
  const toc = tic();

  session.log.debug(`POST to ${versionsUrl} with cdnKey: ${cdnKey} and cdn: ${cdn}...`);
  const resp = await postToUrl(session, `${versionsUrl}`, { cdn_key: cdnKey, cdn });
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

/**
 * Push a new work or new version of work based on myst contents in a folder
 *
 * This will:
 * - Check for project.id (work key) and add it if missing
 * - Upload content to CDN
 * - Check if work exists and if not, create new work
 * - Create new version of work
 */
export async function push(session: ISession, opts?: BaseOpts) {
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
  session.log.info(`📍 Pushing work using key: ${chalk.bold(key)}`);

  await addSourceToLogs(pushLog);
  try {
    await performCleanRebuild(session, opts);
    const cdn = session.config.privateCdnUrl;
    const cdnKey = await uploadAndGetCdnKey(session, cdn, opts);

    const workResp = await getWorkFromKey(session, key);
    let work: WorkDTO;
    if (workResp) {
      session.log.debug(`posting new work version...`);
      work = await postNewWorkVersion(session, workResp.links.versions, cdnKey, cdn);
      session.log.debug(`new work posted with version id ${work.version_id}`);
    } else {
      session.log.debug(`posting new work...`);
      work = await postNewWork(session, cdnKey, cdn, key);
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
      chalk.bold.green(`📄 Work ${workResp ? 'updated' : 'created'} for key ${key}!`),
    );
    writeJsonLogs(session, 'curvenote.push.json', pushLog);
  } catch (err: any) {
    session.log.error(`📣 ${chalk.bold.red(err.message)}`);
    session.log.info('📨 Please contact support@curvenote.com');
    writeJsonLogs(session, 'curvenote.push.json', pushLog);
    process.exit(1);
  }
}
