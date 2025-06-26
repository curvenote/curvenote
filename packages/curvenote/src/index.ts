#!/usr/bin/env node
import 'core-js/actual'; // This adds backwards compatible functionality for various CLIs
import { Command } from 'commander';
import { addCheckCLI } from './check.js';
import { addCleanCLI } from './clean.js';
import { addSyncCLI } from './sync.js';
import { addTokenCLI } from './token.js';
import { addWebCLI } from './web.js';
import { addWorksCLI } from './works.js';
import { addSubmitCLI, addSubmissionCLI } from './submissions.js';
import version from './version.js';
import { addDevHelpCLI } from './devhelp.js';
import { addSiteCLI } from './sites.js';

(process as any).noDeprecation = true;

const program = new Command();
addSyncCLI(program);
addWebCLI(program);
addCleanCLI(program);
addTokenCLI(program);
addCheckCLI(program);
addWorksCLI(program);
addSubmitCLI(program);
addSubmissionCLI(program);
addSiteCLI(program);
addDevHelpCLI(program);

program.version(`v${version}`, '-v, --version', 'Print the current version of curvenote');
program.option('-d, --debug', 'Log out any errors to the console.');
program.parse(process.argv);
