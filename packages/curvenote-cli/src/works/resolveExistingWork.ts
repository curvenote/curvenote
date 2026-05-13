import inquirer from 'inquirer';
import type { WorkDTO } from '@curvenote/common';
import type { ISession } from '../session/types.js';
import { getWorkFromKey, getWorksFromDoi, workKeyExists } from './utils.js';

export type LookupKeyMode = 'id' | 'doi';

type ResolveExistingWorkOpts = {
  mode: LookupKeyMode;
  key?: string;
  doi?: string;
  yes?: boolean;
  forceNew?: boolean;
  contextLabel: string;
  fallbackCreateKey?: string;
};

export async function resolveExistingWork(
  session: ISession,
  opts: ResolveExistingWorkOpts,
): Promise<WorkDTO | undefined> {
  if (opts.mode === 'id') {
    if (opts.forceNew) return undefined;
    if (!opts.key) return undefined;
    return getWorkFromKey(session, opts.key);
  }

  const doi =
    typeof opts.doi === 'string' && opts.doi.trim().length > 0 ? opts.doi.trim() : undefined;
  if (!doi) {
    throw new Error(
      `--key doi requires a non-empty doi in your project config (myst.yml / curvenote.yml). Add a doi field or use --key id.`,
    );
  }

  let works: WorkDTO[] = [];
  if (!opts.forceNew) {
    works = await getWorksFromDoi(session, doi);
  }
  if (works.length === 0) {
    // In DOI mode, creating a new work can still fail if the project.id/work key
    // is already taken by an inaccessible work. Preflight this consistently.
    if (opts.fallbackCreateKey) {
      const owned = await getWorkFromKey(session, opts.fallbackCreateKey);
      if (!owned) {
        const taken = await workKeyExists(session, opts.fallbackCreateKey);
        if (taken) {
          throw new Error(
            `Cannot create a new work for ${opts.contextLabel}: project id/key "${opts.fallbackCreateKey}" is already in use by a work you cannot access.`,
          );
        }
      }
    }
    return undefined;
  }

  let selected = works[0];
  if (works.length > 1 && !opts.yes) {
    const response = await inquirer.prompt([
      {
        name: 'workId',
        type: 'list',
        message: `Multiple works found for DOI "${doi}". Which work should receive a new version for ${opts.contextLabel}?`,
        choices: works.map((work) => ({
          name: `${work.title || 'Untitled'} (${work.id})`,
          value: work.id,
        })),
      },
    ]);
    selected = works.find((work) => work.id === response.workId) ?? selected;
  } else if (!opts.yes) {
    const response = await inquirer.prompt([
      {
        name: 'confirm',
        type: 'confirm',
        default: true,
        message: `A work you own already exists for DOI "${doi}". Create a new version for ${opts.contextLabel}?`,
      },
    ]);
    if (!response.confirm) {
      works = [];
    }
  }

  if (works.length === 0) return undefined;
  return selected;
}
