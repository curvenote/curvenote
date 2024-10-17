import { Command } from 'commander';
import {
  makeBuildCommand,
  makeStartCommand,
  makeYesOption,
  makeStrictOption,
  makeCheckLinksOption,
  makeExecuteOption,
} from 'myst-cli';
import { web } from '@curvenote/cli';
import { clirun } from './clirun.js';
import {
  makeCIOption,
  makeForceOption,
  makeDomainOption,
  makeVenueOption,
  makeResumeOption,
  makeMaxSizeWebpOption,
} from './options.js';

function makeCurvenoteStartCLI(program: Command) {
  const command = makeStartCommand().action(
    clirun(web.curvenoteStart, { program, requireSiteConfig: true, keepAlive: true }),
  );
  return command;
}

function makeBuildCLI(program: Command) {
  const command = makeBuildCommand().action(
    clirun(web.curvenoteBuild, {
      program,
      requireSiteConfig: true,
      keepAlive: (_, opts) => !!opts.watch,
    }),
  );
  return command;
}

function makeDeployCLI(program: Command) {
  const command = new Command('deploy')
    .description('Deploy content to https://*.curve.space or your own domain')
    .addOption(makeYesOption())
    .addOption(makeForceOption())
    .addOption(makeCIOption())
    .addOption(makeStrictOption())
    .addOption(makeDomainOption())
    .addOption(makeVenueOption())
    .addOption(makeCheckLinksOption())
    .addOption(makeResumeOption())
    .addOption(makeMaxSizeWebpOption(3))
    .addOption(makeExecuteOption('Execute Notebooks'))
    .action(clirun(web.deploy, { program, requireSiteConfig: true }));
  return command;
}

export function addWebCLI(program: Command): void {
  // Top level are `start`, `deploy`, and `build`
  program.addCommand(makeBuildCLI(program));
  program.addCommand(makeCurvenoteStartCLI(program));
  program.addCommand(makeDeployCLI(program));
}
