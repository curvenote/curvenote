import type { ISession } from '../session/types.js';
import { postNewWork, postNewWorkVersionFromMetadata } from './push.js';
import type { RegisterWorkOpts } from './types.js';
import { postNewSubmission, postUpdateSubmissionWorkVersion } from '../submissions/utils.js';
import { determineCollectionAndKind, getVenueCollections } from '../submissions/submit.utils.js';
import { checkVenueExists, ensureVenue } from '../sites/utils.js';
import { writeJsonLogs } from 'myst-cli';
import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import inquirer from 'inquirer';
import { getFromJournals } from '../utils/api.js';
import type { MySubmissionsListingDTO, WorkDTO } from '@curvenote/common';
import { getWorksFromDoi } from './utils.js';

function detectContentYamlPath() {
  const cwd = process.cwd();
  const curvenoteConfig = path.join(cwd, 'curvenote.yml');
  if (fs.existsSync(curvenoteConfig)) return curvenoteConfig;
  const mystConfig = path.join(cwd, 'myst.yml');
  if (fs.existsSync(mystConfig)) return mystConfig;
  return undefined;
}

function parseContentYaml(session: ISession, filePath?: string) {
  if (!filePath) return undefined;
  if (!fs.existsSync(filePath)) {
    throw new Error(`content yaml file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yamlLoad(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`invalid content yaml: expected object at root`);
  }
  const root =
    (parsed as any).project && typeof (parsed as any).project === 'object'
      ? (parsed as any).project
      : (parsed as any);

  const authorDetails = Array.isArray(root.authors)
    ? root.authors.map((author: any) => (typeof author === 'string' ? { name: author } : author))
    : undefined;
  const authors = authorDetails
    ?.map((author: any) => author?.name)
    .filter((name: any): name is string => typeof name === 'string' && name.length > 0);

  session.log.debug(`Loaded content metadata from ${filePath}`);
  return {
    title: typeof root.title === 'string' ? root.title : undefined,
    description: typeof root.description === 'string' ? root.description : undefined,
    authors,
    author_details: authorDetails,
    doi: typeof root.doi === 'string' ? root.doi : undefined,
    date:
      typeof root.date === 'string'
        ? root.date
        : root.date instanceof Date
          ? root.date.toISOString()
          : undefined,
  };
}

function parseMetadataJson(metadataInput?: string) {
  if (!metadataInput) return undefined;
  const raw = fs.existsSync(metadataInput)
    ? fs.readFileSync(metadataInput, 'utf-8')
    : metadataInput;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invalid metadata json (provide inline JSON or a JSON file path)`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`invalid metadata json: expected an object`);
  }
  return parsed as Record<string, any>;
}

export async function register(session: ISession, opts?: RegisterWorkOpts) {
  if (session.isAnon) {
    throw new Error(
      '⛔️ You must be authenticated for this command. Use `curvenote token set [token]`',
    );
  }
  if (!opts?.venue) {
    throw new Error('venue is required');
  }
  const yamlMetadata = parseContentYaml(session, detectContentYamlPath());
  const metadata = parseMetadataJson(opts.metadata);
  const title = opts.title ?? yamlMetadata?.title;
  if (!title) {
    throw new Error('title is required (pass --title or set title in myst.yml/curvenote.yml)');
  }

  const venue = await ensureVenue(session, opts.venue, opts);
  await checkVenueExists(session, venue);

  const doi = yamlMetadata?.doi;
  let work: WorkDTO;
  let workVersionId: string;

  let existingWorks: WorkDTO[] = [];
  if (doi && !opts.new) {
    existingWorks = await getWorksFromDoi(session, doi);
  }

  if (existingWorks.length > 0) {
    let selected: WorkDTO = existingWorks[0];
    if (existingWorks.length > 1 && !opts.yes) {
      const { workId } = await inquirer.prompt([
        {
          name: 'workId',
          type: 'list',
          message: `Multiple works found for DOI "${doi}". Which work should receive a new version?`,
          choices: existingWorks.map((w) => ({
            name: `${w.title || 'Untitled'} (${w.id})`,
            value: w.id,
          })),
        },
      ]);
      selected = existingWorks.find((w) => w.id === workId) ?? selected;
    } else if (!opts.yes) {
      const { confirm } = await inquirer.prompt([
        {
          name: 'confirm',
          type: 'confirm',
          default: true,
          message: `A work you own already exists for DOI "${doi}". Register a new version on that work?`,
        },
      ]);
      if (!confirm) {
        existingWorks = [];
      }
    }

    if (existingWorks.length > 0) {
      // Create a new work version (metadata-only) on the existing work
      const updated = await postNewWorkVersionFromMetadata(session, selected.links.versions, {
        title,
        description: yamlMetadata?.description,
        authors: yamlMetadata?.authors,
        author_details: yamlMetadata?.author_details,
        doi,
        date: yamlMetadata?.date,
        contains: opts.source ? [opts.source] : undefined,
        metadata,
      });
      work = updated;
      workVersionId = updated.version_id as string;
    } else {
      // fallthrough to new work
      work = await postNewWork(session, '', '', opts.key, {
        title,
        description: yamlMetadata?.description,
        authors: yamlMetadata?.authors,
        author_details: yamlMetadata?.author_details,
        doi,
        date: yamlMetadata?.date,
        contains: opts.source ? [opts.source] : undefined,
        metadata,
      });
      workVersionId = work.version_id as string;
    }
  } else {
    work = await postNewWork(session, '', '', opts.key, {
      title,
      description: yamlMetadata?.description,
      authors: yamlMetadata?.authors,
      author_details: yamlMetadata?.author_details,
      doi,
      date: yamlMetadata?.date,
      contains: opts.source ? [opts.source] : undefined,
      metadata,
    });
    workVersionId = work.version_id as string;
  }

  if (!workVersionId) throw new Error('Failed to create a work version');

  const collections = await getVenueCollections(session, venue);
  const { kind, collection } = await determineCollectionAndKind(session, venue, collections, {
    kind: opts.kind,
    collection: opts.collection,
    yes: opts.yes,
  });

  // If a submission already exists for this work at this venue, create a new submission version
  const mine = (await getFromJournals(
    session,
    `/my/submissions/?work_id=${encodeURIComponent(work.id)}&site=${encodeURIComponent(venue)}`,
  )) as MySubmissionsListingDTO;
  const existingSubmission = mine.items.find(
    (s) => s.site_name === venue && s.active_version.work_id === work.id,
  );
  let submissionId: string;
  let submissionDateCreated: string;
  let submissionVersionId: string;
  let submissionVersionDateCreated: string;
  if (existingSubmission) {
    const sv = await postUpdateSubmissionWorkVersion(
      session,
      venue,
      existingSubmission.links.versions,
      workVersionId,
    );
    submissionId = existingSubmission.id;
    submissionDateCreated = existingSubmission.date_created;
    submissionVersionId = sv.id;
    submissionVersionDateCreated = sv.date_created;
  } else {
    const submission = await postNewSubmission(
      session,
      venue,
      collection.id,
      kind.id,
      workVersionId,
      opts.draft ?? false,
    );
    submissionId = submission.id;
    submissionDateCreated = submission.date_created;
    submissionVersionId = submission.active_version_id;
    submissionVersionDateCreated = submission.date_created;
  }

  writeJsonLogs(session, 'curvenote.work.register.json', {
    venue,
    work: { id: work.id, date_created: work.date_created },
    workVersion: { id: workVersionId, date_created: work.date_created },
    submission: { id: submissionId, date_created: submissionDateCreated },
    submissionVersion: { id: submissionVersionId, date_created: submissionVersionDateCreated },
  });

  session.log.info('✅ Blank work and submission records created.');
  session.log.info(`work=${work.id}`);
  session.log.info(`workVersion=${workVersionId}`);
  session.log.info(`submission=${submissionId}`);
  session.log.info(`submissionVersion=${submissionVersionId}`);
}
