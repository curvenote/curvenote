import { Command } from 'commander';
import { web } from '@curvenote/cli';
import { clirun } from './clirun.js';
import {
  makeCIOption,
  makeForceOption,
  makeYesOption,
  makeStrictOption,
  makeCheckLinksOption,
  makeKeepHostOption,
  makeHeadlessOption,
  makeDomainOption,
  makeVenueOption,
  makeExecuteOption,
  makeResumeOption,
  makeMaxSizeWebpOption,
} from './options.js';

function makeCurvenoteStartCLI(program: Command) {
  const command = new Command('start')
    .description('Start a local project as a web server')
    .addOption(makeKeepHostOption())
    .addOption(makeHeadlessOption())
    .addOption(makeExecuteOption('Execute Notebooks'))
    .addOption(makeMaxSizeWebpOption())
    .action(clirun(web.startCurvenoteServer, { program, requireSiteConfig: true }));
  return command;
}

function makeBuildCLI(program: Command) {
  const command = new Command('build')
    .description('Build MyST site content')
    .addOption(makeExecuteOption('Execute Notebooks'))
    .addOption(makeForceOption())
    .addOption(makeCheckLinksOption())
    .addOption(makeStrictOption())
    .addOption(makeMaxSizeWebpOption())
    .action(clirun(web.buildCurvenoteSite, { program, requireSiteConfig: true }));
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
    .addOption(makeMaxSizeWebpOption(1000))
    .addOption(makeExecuteOption('Execute Notebooks'))
    .action(clirun(web.deploy, { program, requireSiteConfig: true }));
  return command;
}

export function addWebCLI(program: Command): void {
  // Top level are `start`, `deploy`, and `build`
  program.addCommand(makeCurvenoteStartCLI(program));
  program.addCommand(makeBuildCLI(program));
  program.addCommand(makeDeployCLI(program));
}
