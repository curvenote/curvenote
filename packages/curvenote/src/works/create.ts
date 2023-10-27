import {
  buildSite,
  clean,
  collectAllBuildExportOptions,
  localArticleExport,
  selectors,
} from 'myst-cli';
import path from 'node:path';
import type { ISession } from '../session/types.js';
import {
  addOxaTransformersToOpts,
  confirmOrExit,
  uploadContentAndDeployToPrivateCdn,
} from '../utils/index.js';
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
  if (!transferData?.work?.id) {
    await confirmOrExit(`Upload a new work based on contents of your local folder?`, opts);
  } else {
    session.log.info(
      `${chalk.bold(
        `🧐 Found a "transfer.yml" in this folder with an existing work id ${transferData.work.id}.`,
      )}`,
    );
    await confirmOrExit(
      `Upload a version of this work based on contents of your local folder?`,
      opts,
    );
  }

  session.log.info('\n\n\t✨✨✨  performing a clean re-build of your work  ✨✨✨\n\n');
  // clean the site folder, otherwise downloadable files will accumulate
  await clean(session, [], { site: true, html: true, temp: true, exports: true, yes: true });
  const exportOptionsList = await collectAllBuildExportOptions(session, [], { all: true });
  const exportLogList = exportOptionsList.map((exportOptions) => {
    return `${path.relative('.', exportOptions.$file)} -> ${exportOptions.output}`;
  });
  session.log.info(`📬 Performing exports:\n   ${exportLogList.join('\n   ')}`);
  await localArticleExport(session, exportOptionsList, {});
  session.log.info(`⛴ Exports complete`);
  // Build the files in the content folder and process them
  await buildSite(session, addOxaTransformersToOpts(session, opts ?? {}));

  session.log.info(`✅ Work rebuild complete`);

  const cdnKey = await uploadContentAndDeployToPrivateCdn(session, opts);
  session.log.info(`\n\n🚀 ${chalk.bold.green(`Content uploaded with key ${cdnKey}`)}.`);

  // TODO PRIVATE CDN
  if (!transferData?.work?.id) {
    const { work, workVersion } = await postNewWork(session, cdnKey, session.PRIVATE_CDN);
    session.log.info(`\n\n🚀 ${chalk.bold.green('Your work was successfully created')}.`);
    session.log.info(
      `Your work id has been added to the "./transfer.yml" file, please commit this to your repository to enable version and submission tracking.`,
    );
    await upwriteTransferFile(session, { work, work_version: workVersion });
  } else {
    const { work } = transferData;
    const { workVersion } = await postNewWorkVersion(session, work.id, cdnKey, session.PRIVATE_CDN);
    await upwriteTransferFile(session, { work: work, work_version: workVersion });
    session.log.info(`\n\n🚀 ${chalk.bold.green('Your work was successfully posted')}.`);
    session.log.info(
      `The "./transfer.yml" file has been updated with the new work version's id, please commit this change.`,
    );
  }
}
