import chalk from 'chalk';
import { docLinks } from '../../docs.js';
import { MyUser } from '../../models.js';
import type { ISession } from '../../session/types.js';
import { CURVENOTE_YML } from './types.js';

export const WELCOME = async (session: ISession) => `

${chalk.bold.green('Welcome to the Curvenote CLI!!')} 👋

${chalk.bold('curvenote init')} walks you through creating a ${chalk.bold(CURVENOTE_YML)} file.

You can use this client library to:

 - ${chalk.bold('sync content')} to & from Curvenote
 - ${chalk.bold('build & export')} professional PDFs
 - create a ${chalk.bold('local website')} & deploy to ${chalk.blue(
   `https://${
     session.isAnon ? 'your' : (await new MyUser(session).get()).data.username
   }.curve.space`,
 )}

Find out more here:
${docLinks.overview}

`;

export const FINISHED = async (session: ISession) => `

${chalk.bold(chalk.green('Curvenote setup is complete!!'))} 🚀

You can use this client library to:

  - ${chalk.bold('curvenote pull')}: Update your content to what is on https://curvenote.com
  - ${chalk.bold('curvenote start')}: Start a local web server now!
  - ${chalk.bold('curvenote deploy')}: Share content on ${chalk.blue(
    `https://${
      session.isAnon ? 'your' : (await new MyUser(session).get()).data.username
    }.curve.space`,
  )}

Find out more here:
${docLinks.overview}

`;
