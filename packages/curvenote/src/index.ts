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

const program = new Command();
addSyncCLI(program);
addWebCLI(program);
addTokenCLI(program);
addCheckCLI(program);
addCleanCLI(program);
addWorksCLI(program);
addSubmitCLI(program);
addSubmissionCLI(program);

program.version(`v${version}`, '-v, --version', 'Print the current version of curvenote');
program.option('-d, --debug', 'Log out any errors to the console.');
program.parse(process.argv);
