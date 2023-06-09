#!/usr/bin/env node
import { Command } from 'commander';
import version from '../version.js';
import { addAuthCLI } from './auth.js';
import { addCleanCLI } from './clean.js';
import { addExportCLI } from './export.js';
import { addSyncCLI } from './sync.js';
import { addTokenCLI } from './token.js';
import { addWebCLI } from './web.js';

const program = new Command();
addSyncCLI(program);
addWebCLI(program);
addTokenCLI(program);
addAuthCLI(program);
addExportCLI(program);
addCleanCLI(program);

program.version(`v${version}`, '-v, --version', 'Print the current version of curvenote');
program.option('-d, --debug', 'Log out any errors to the console.');
program.parse(process.argv);
