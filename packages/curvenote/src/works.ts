import { Command, Option } from 'commander';
import { works } from '@curvenote/cli';
import { clirun } from './clirun.js';
import { makeYesOption } from 'myst-cli';
import {
  makeResumeOption,
  makeMaxSizeWebpOption,
  makeCollectionOption,
  makeDraftOption,
  makeKindOption,
} from './options.js';

function makeWorksCLI() {
  const command = new Command('work').description('Create and manage your Works').alias('works');
  return command;
}

function makeWorksListCLI(program: Command) {
  const command = new Command('list')
    .description('List your Works')
    .action(clirun(works.list, { program, requireSiteConfig: true }));
  return command;
}

function makeWorksPushCLI(program: Command) {
  const command = new Command('push')
    .description('Push a new Work or a new version of an existing Work')
    .option('--public', 'Push to the public CDN instead of the private CDN')
    .addOption(makeYesOption())
    .addOption(makeResumeOption())
    .addOption(makeMaxSizeWebpOption(3))
    .action(clirun(works.push, { program, requireSiteConfig: true }));
  return command;
}

function makeWorksRegisterCLI(program: Command) {
  const command = new Command('register')
    .description('Register a work/submission without build/upload')
    .option('--title <string>', 'Title for the work version')
    .requiredOption('--venue <string>', 'Venue to create the submission under')
    .addOption(makeKindOption())
    .addOption(makeCollectionOption())
    .addOption(makeDraftOption())
    .addOption(new Option('--key <string>', 'Optional stable work key'))
    .addOption(new Option('--new', 'Create a new work even if a DOI match exists'))
    .addOption(new Option('--source <string>', 'Source label that is written to work.contains'))
    .addOption(
      new Option('--metadata <json-or-file>', 'Inline JSON object or path to JSON metadata file'),
    )
    .addOption(makeYesOption())
    .action(clirun(works.register, { program, skipProjectLoading: true }));
  return command;
}

export function addWorksCLI(program: Command): void {
  const worksProgram = makeWorksCLI();
  worksProgram.addCommand(makeWorksListCLI(program));
  worksProgram.addCommand(makeWorksPushCLI(program));
  worksProgram.addCommand(makeWorksRegisterCLI(program));
  program.addCommand(worksProgram);
}
