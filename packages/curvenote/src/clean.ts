import { Command, Option } from 'commander';
import { clean } from 'myst-cli';
import {
  makeCacheOption,
  makeDocxOption,
  makeExecuteOption,
  makeJatsOption,
  makeLogsOption,
  makeMecaOption,
  makePdfOption,
  makeSiteOption,
  makeTexOption,
  makeTypstOption,
  makeYesOption,
} from './options.js';
import { clirun } from './clirun.js';

export function makeTempOption() {
  return new Option(
    '--temp',
    'Delete the _build/temp folder where intermediate build artifacts are saved',
  ).default(false);
}

export function makeExportsOption() {
  return new Option(
    '--exports',
    'Delete the _build/exports folder where exports are saved by default',
  ).default(false);
}

export function makeTemplatesOption() {
  return new Option(
    '--templates',
    'Delete the _build/templates folder where downloaded templates are saved',
  ).default(false);
}

export function makeAllOption() {
  return new Option(
    '-a, --all',
    'Delete all exports, site content, templates, and temp files created by MyST',
  ).default(false);
}

export function makeCleanCLI(program: Command) {
  const command = new Command('clean')
    .description('Clean built pdf, tex, word, etc exports and other build artifacts')
    .argument('[files...]', 'list of files to clean corresponding outputs')
    .addOption(makePdfOption('Clean'))
    .addOption(makeTexOption('Clean'))
    .addOption(makeTypstOption('Clean'))
    .addOption(makeDocxOption('Clean'))
    .addOption(makeJatsOption('Clean'))
    .addOption(makeMecaOption('Clean'))
    .addOption(makeSiteOption('Clean'))
    .addOption(makeTempOption())
    .addOption(makeLogsOption('Clean logs'))
    .addOption(makeCacheOption('Clean web request cache'))
    .addOption(makeExportsOption())
    .addOption(makeExecuteOption('Clean execute cache'))
    .addOption(makeTemplatesOption())
    .addOption(makeAllOption())
    .addOption(makeYesOption())
    .action(clirun(clean, { program }));
  return command;
}

export function addCleanCLI(program: Command) {
  program.addCommand(makeCleanCLI(program));
}
