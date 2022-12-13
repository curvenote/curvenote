import { Command } from 'commander';
import { buildSite, startServer } from 'myst-cli';
import { web } from '../index';
import { clirun } from './utils';
import {
  makeCIOption,
  makeForceOption,
  makeYesOption,
  makeStrictOption,
  makeCheckLinksOption,
  makeKeepHostOption,
  makeHeadlessOption,
} from './options';

function makeCurvenoteStartCLI(program: Command) {
  const command = new Command('start')
    .description('Start a local project as a web server')
    .addOption(makeKeepHostOption())
    .addOption(makeHeadlessOption())
    .action(clirun(startServer, { program, requireSiteConfig: true }));
  return command;
}

function makeBuildCLI(program: Command) {
  const command = new Command('build')
    .description('Build Curvenote site content')
    .addOption(makeForceOption())
    .addOption(makeCheckLinksOption())
    .addOption(makeStrictOption())
    .action(clirun(buildSite, { program, requireSiteConfig: true }));
  return command;
}

function makeDeployCLI(program: Command) {
  const command = new Command('deploy')
    .description('Deploy content to https://*.curve.space or your own domain')
    .addOption(makeYesOption())
    .addOption(makeForceOption())
    .addOption(makeCIOption())
    .addOption(makeStrictOption())
    .addOption(makeCheckLinksOption())
    .action(clirun(web.deploy, { program, requireSiteConfig: true }));
  return command;
}

export function addWebCLI(program: Command): void {
  // Top level are `start`, `deploy`, and `build`
  program.addCommand(makeCurvenoteStartCLI(program));
  program.addCommand(makeBuildCLI(program));
  program.addCommand(makeDeployCLI(program));
}
