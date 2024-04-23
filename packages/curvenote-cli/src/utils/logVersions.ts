import path from 'node:path';
import type { ISession } from '../session/types.js';
import fs from 'node:fs';
import type check from 'check-node-version';
import { version as mystCliVersion } from 'myst-cli';
import { isDirectory } from 'myst-cli-utils';
import CurvenoteVersion from '../version.js';

type VersionResults = Parameters<Parameters<typeof check>[1]>[1];

function packageJsonInFolder(folder: string) {
  const packageJson = path.join(folder, 'package.json');
  if (fs.existsSync(packageJson)) return packageJson;
}

export function logVersions(session: ISession, result: VersionResults | null, debug = true) {
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
