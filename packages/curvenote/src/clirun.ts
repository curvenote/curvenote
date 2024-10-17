import type { Command } from 'commander';
import { checkNodeVersion, getNodeVersion, selectors } from 'myst-cli';
import { anonSession, getSession, logVersions } from '@curvenote/cli';
import type { ISession, SessionOpts } from '@curvenote/cli';
import chalk from 'chalk';

export function clirun(
  func:
    | ((session: ISession, ...args: any[]) => Promise<void>)
    | ((session: ISession, ...args: any[]) => void),
  cli: {
    program: Command;
    anonymous?: boolean;
    skipProjectLoading?: boolean;
    requireSiteConfig?: boolean;
    hideNoTokenWarning?: boolean;
    /**
     * Wait for all promises to finish, even if the main command is complete.
     *
     * For example, when starting a watch process.
     * For build commands, this should be `false`, the default, to ensure a speedy exit from the CLI.
     */
    keepAlive?: boolean | ((...args: any[]) => boolean);
  },
) {
  return async (...args: any[]) => {
    const opts = cli.program.opts() as SessionOpts;
    const useSession = cli.anonymous
      ? anonSession({ ...opts })
      : getSession({
          ...opts,
          hideNoTokenWarning: cli.hideNoTokenWarning,
        });
    const versions = await getNodeVersion(useSession);
    logVersions(useSession, versions);
    const versionsInstalled = await checkNodeVersion(useSession);
    if (!versionsInstalled) process.exit(1);
    if (!cli.skipProjectLoading) {
      await useSession.reload();
      const state = useSession.store.getState();
      const siteConfig = selectors.selectCurrentSiteConfig(state);
      if (cli.requireSiteConfig && !siteConfig) {
        const projectConfig = selectors.selectCurrentProjectConfig(state);
        let message: string;
        if (projectConfig) {
          message = `No "site" config found in ${selectors.selectCurrentProjectFile(state)}`;
        } else {
          message = `You must be in a directory with a config file: ${useSession.configFiles.join(
            ', ',
          )}`;
        }
        useSession.log.error(`${message}\n\nDo you need to run: ${chalk.bold('curvenote init')}`);
        process.exit(1);
      }
    }
    try {
      await func(useSession, ...args);
    } catch (error) {
      if (opts.debug) {
        useSession.log.debug(`\n\n${(error as Error)?.stack}\n\n`);
      }
      useSession.log.error((error as Error).message);
      logVersions(useSession, versions, false);
      useSession.showUpgradeNotice?.();
      process.exit(1);
    }
    useSession.showUpgradeNotice?.();
    if (typeof cli?.keepAlive === 'function') {
      if (!cli.keepAlive(...args)) process.exit(0);
    } else if (!cli?.keepAlive) {
      process.exit(0);
    }
  };
}
