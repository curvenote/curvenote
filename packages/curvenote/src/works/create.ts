import { selectors } from 'myst-cli';
import type { ISession } from '../session/types.js';
import { confirmOrExit, uploadContentAndDeployToPrivateCdn } from '../utils/index.js';
import chalk from 'chalk';
import { postNewWork, postNewWorkVersion } from './utils.js';
import { loadTransferFile, upwriteTransferFile } from './transfer.js';

export async function create(session: ISession, opts?: { ci?: boolean; yes?: boolean }) {
  if (session.isAnon) {
    throw new Error(
      '⚠️ You must be authenticated for this call. Use `curvenote token set [token]`',
    );
  }

  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig) {
    throw new Error('🧐 No site config found.');
  }

  const transferData = await loadTransferFile(session);
  if (!transferData?.work_id) {
    await confirmOrExit(`Upload a new work based on contents of your local folder?`, opts);
  } else {
    session.log.info(
      `${chalk.bold(
        `🧐 Found a "transfer.yml" in this folder with an existing work id ${transferData.work_id}.`,
      )}`,
    );
    await confirmOrExit(
      `Upload a version of this work based on contents of your local folder?`,
      opts,
    );
  }

  const cdnKey = await uploadContentAndDeployToPrivateCdn(session, opts);

  // TODO switch to private cdn once journals API can access it
  // const cdn = `https://prv.curvenote.com`;
  const cdn = `https://cdn.curvenote.com`;

  if (!transferData?.work_id) {
    const { workId, workVersionId } = await postNewWork(session, cdnKey, cdn);
    session.log.info(`\n\n🚀 ${chalk.bold.green('Your work was successfully created')}.`);
    session.log.info(
      `Your work id has been added to the "./transfer.yml" file, please commit this to your repository to enable version and submission tracking.`,
    );
    await upwriteTransferFile(session, { work_id: workId, work_version_id: workVersionId });
  } else {
    const { work_id } = transferData;
    const { workVersionId } = await postNewWorkVersion(session, work_id, cdnKey, cdn);
    await upwriteTransferFile(session, { work_id, work_version_id: workVersionId });
    session.log.info(`\n\n🚀 ${chalk.bold.green('Your work was successfully posted')}.`);
    session.log.info(
      `The "./transfer.yml" file has been updated with the new work version's id, please commit this change.`,
    );
  }
}
