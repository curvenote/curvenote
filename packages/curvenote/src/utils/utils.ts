import inquirer from 'inquirer';
import path from 'node:path';
import type { Logger } from 'myst-cli-utils';
import type { JsonObject, VersionId } from '@curvenote/blocks';
import type { ISession } from '../session/types.js';
import { OxaTransformer, transformOxalinkStore } from '../transforms/links.js';

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
