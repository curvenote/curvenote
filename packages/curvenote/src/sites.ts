import { Command } from 'commander';
import { sites } from '@curvenote/cli';
import { clirun } from './clirun.js';

function makeSiteCLI() {
  const command = new Command('site').description('Manage your Sites');
  return command;
}

function makeSiteInitCLI(program: Command) {
  const command = new Command('init')
    .description('Initialize Site content')
    .argument('[name]', 'Site name to initialize')
    .option('--set-content', 'Set Site landing content based on current Work')
    .action(clirun(sites.init, { program, requireSiteConfig: true }));
  return command;
}

export function addSiteCLI(program: Command): void {
  const siteProgram = makeSiteCLI();
  siteProgram.addCommand(makeSiteInitCLI(program));
  program.addCommand(siteProgram);
}
