import inquirer from 'inquirer';
import path from 'node:path';
import { writeFileToFolder, type Logger } from 'myst-cli-utils';
import type { JsonObject, VersionId } from '@curvenote/blocks';
import type { ISession } from '../session/types.js';
import { OxaTransformer, transformOxalinkStore } from '../transforms/links.js';
import chalk from 'chalk';
import fs from 'node:fs';
import type check from 'check-node-version';
import { getNodeVersion, version as mystCliVersion } from 'myst-cli';
import { LogLevel, isDirectory } from 'myst-cli-utils';
import CurvenoteVersion from '../version.js';
import { docLinks } from '../docs.js';

export const BUILD_FOLDER = '_build';
export const THUMBNAILS_FOLDER = 'thumbnails';

export function resolvePath(optionalPath: string | undefined, filename: string) {
  if (optionalPath) return path.join(optionalPath, filename);
  if (path.isAbsolute(filename)) return filename;
  return path.join('.', filename);
}

export function versionIdToURL(versionId: VersionId) {
  return `/blocks/${versionId.project}/${versionId.block}/versions/${versionId.version}`;
}

export function checkForClientVersionRejection(log: Logger, status: number, body: JsonObject) {
  if (status === 400) {
    log.debug(`Request failed: ${JSON.stringify(body)}`);
    if (body?.errors?.[0].code === 'outdated_client') {
      log.error('Please run `npm i curvenote@latest` to update your client.');
    }
  }
}

export async function confirmOrExit(message: string, opts?: { yes?: boolean }) {
  if (opts?.yes) return;
  const question = await inquirer.prompt([
    {
      name: 'confirm',
      message,
      type: 'confirm',
      default: false,
    },
  ]);
  if (!question.confirm) {
    process.exit();
  }
}

/** Add oxa link transformers to options */
export function addOxaTransformersToOpts(session: ISession, opts: Record<string, any>) {
  return {
    ...opts,
    extraLinkTransformers: [...(opts.extraLinkTransformers ?? []), new OxaTransformer(session)],
    extraTransforms: [...(opts.extraTransforms ?? []), transformOxalinkStore as any],
  };
}

export function writeJsonLogs(session: ISession, name: string, logData: Record<string, any>) {
  writeFileToFolder(path.join(session.buildPath(), 'logs', name), JSON.stringify(logData, null, 2));
}

const INSTALL_NODE_MESSAGE = `
You can download Node here:

${chalk.bold('https://nodejs.org/en/download/')}

Upgrade your Node Package Manager (npm) using:

${chalk.bold('npm install -g npm@latest')}

Additional Documentation:

${chalk.bold.blue(docLinks.installNode)}
`;

type VersionResults = Parameters<Parameters<typeof check>[1]>[1];

function packageJsonInFolder(folder: string) {
  const packageJson = path.join(folder, 'package.json');
  if (fs.existsSync(packageJson)) return packageJson;
}

function logVersions(session: ISession, result: VersionResults | null, debug = true) {
  const versions: string[][] = [];
  Object.entries(result?.versions ?? {}).forEach(([name, p]) => {
    versions.push([
      name,
      p.version ? `${p.version}` : 'Package Not Found',
      `Required: ${p.wanted?.raw || ''}`,
      p.isSatisfied ? '✅' : '⚠️',
    ]);
  });
  versions.push(['myst-cli', mystCliVersion]);
  versions.push(['curvenote', CurvenoteVersion]);

  const siteTemplatePackageJsons: (string | undefined)[] = [];
  const siteTemplateFolder = path.join(session.buildPath(), 'templates', 'site');
  if (fs.existsSync(siteTemplateFolder)) {
    fs.readdirSync(siteTemplateFolder)
      .map((folder) => path.join(siteTemplateFolder, folder))
      .filter((folder) => isDirectory(folder))
      .forEach((folder) => {
        siteTemplatePackageJsons.push(packageJsonInFolder(folder));
        fs.readdirSync(folder)
          .map((subfolder) => path.join(folder, subfolder))
          .filter((subfolder) => isDirectory(subfolder))
          .forEach((subfolder) => {
            siteTemplatePackageJsons.push(packageJsonInFolder(subfolder));
          });
      });
  }
  siteTemplatePackageJsons
    .filter((file): file is string => !!file)
    .forEach((file) => {
      try {
        // TODO: Improve this to tell you more about themes
        const packageJson = JSON.parse(fs.readFileSync(file).toString()) as {
          name: string;
          version: string;
        };
        if (packageJson.name && packageJson.version) {
          versions.push([packageJson.name, packageJson.version]);
        }
      } catch (error) {
        // pass
      }
    });
  const versionString = versions
    .map(
      ([n, v, r, c]) =>
        `\n - ${n.padEnd(25, ' ')}${v.padStart(10, ' ').padEnd(15, ' ')}${r?.padEnd(25) ?? ''}${
          c ?? ''
        }`,
    )
    .join('');
  session.log[debug ? 'debug' : 'info'](`\n\nCurvenote CLI Versions:${versionString}\n\n`);
}

export async function checkNodeVersion(session: ISession): Promise<boolean> {
  const result = await getNodeVersion(session);
  if (!result) return false;
  if (result.isSatisfied) return true;
  const versions = await getNodeVersion(session);
  logVersions(session, versions, false);
  session.log.error('Please update your Node or NPM versions.\n');
  session.log.info(INSTALL_NODE_MESSAGE);
  return false;
}

export function getLogLevel(level: LogLevel | boolean | string = LogLevel.info): LogLevel {
  if (typeof level === 'number') return level;
  const useLevel: LogLevel = level ? LogLevel.debug : LogLevel.info;
  return useLevel;
}
