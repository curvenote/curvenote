#!/usr/bin/env node
import { Command } from 'commander';
import version from '../version.js';
import { addAuthCLI } from './auth.js';
import { addCheckCLI } from './check.js';
import { addCleanCLI } from './clean.js';
import { addExportCLI } from './export.js';
import { addSyncCLI } from './sync.js';
import { addTokenCLI } from './token.js';
import { addWebCLI } from './web.js';
import { addWorksCLI } from './works.js';
import { addSubmitCLI, addSubmissionsCLI } from './submissions.js';

const program = new Command();
addSyncCLI(program);
addWebCLI(program);
addTokenCLI(program);
addAuthCLI(program);
addExportCLI(program);
addCheckCLI(program);
addCleanCLI(program);
addWorksCLI(program);
addSubmitCLI(program);
addSubmissionsCLI(program);

program.version(`v${version}`, '-v, --version', 'Print the current version of curvenote');
program.option('-d, --debug', 'Log out any errors to the console.');
program.parse(process.argv);
