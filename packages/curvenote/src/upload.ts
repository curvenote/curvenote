import { Command } from 'commander';
import { upload } from '@curvenote/cli';
import { clirun } from './clirun.js';
import { makeResumeOption } from './options.js';

export function addTestUploadCLI(program: Command) {
  const command = new Command('upload');
  command.command('new', { hidden: true }).addOption(makeResumeOption()).action(
    clirun(upload.uploadToTmpCdn, {
      program,
    }),
  );

  program.addCommand(command, { hidden: true });
}
