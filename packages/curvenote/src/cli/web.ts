import { Command } from 'commander';
import { web } from '../index.js';
import { clirun } from './utils.js';
import {
  makeCIOption,
  makeForceOption,
  makeYesOption,
  makeStrictOption,
  makeCheckLinksOption,
  makeKeepHostOption,
  makeHeadlessOption,
  makePdfOption,
  makeTexOption,
  makeDocxOption,
  makeSiteOption,
  makeDomainOption,
  makeVenueOption,
} from './options.js';

function makeCurvenoteStartCLI(program: Command) {
  const command = new Command('start')
    .description('Start a local project as a web server')
    .addOption(makeKeepHostOption())
    .addOption(makeHeadlessOption())
    .action(clirun(web.startCurvenoteServer, { program, requireSiteConfig: true }));
  return command;
}

function makeBuildCLI(program: Command) {
  const command = new Command('build')
    .description(
      'Build pdf, tex, and word exports from MyST files as well as build MyST site content',
    )
    .argument('[files...]', 'list of files to export')
    .addOption(makePdfOption('Build'))
    .addOption(makeTexOption('Build'))
    .addOption(makeDocxOption('Build'))
    .addOption(makeSiteOption('Build'))
    .addOption(makeForceOption())
    .addOption(makeCheckLinksOption())
    .addOption(makeStrictOption())
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
    .action(clirun(web.deploy, { program, requireSiteConfig: true }));
  return command;
}

export function addWebCLI(program: Command): void {
  // Top level are `start`, `deploy`, and `build`
  program.addCommand(makeCurvenoteStartCLI(program));
  program.addCommand(makeBuildCLI(program));
  program.addCommand(makeDeployCLI(program));
}
