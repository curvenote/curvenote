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
import { getFromJournals } from '../utils/api.js';
import type { MySubmissionsListingDTO, WorkDTO } from '@curvenote/common';
import { resolveExistingWork } from './resolveExistingWork.js';

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
    raw: parsed as Record<string, any>,
    id: typeof root.id === 'string' ? root.id : undefined,
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
  if ((opts.cdn && !opts.cdnKey) || (!opts.cdn && opts.cdnKey)) {
    throw new Error('cdn and cdnKey must be provided together');
  }
  if (opts.cdn && !opts.source) {
    throw new Error('source is required when cdn/cdnKey are provided');
  }
  const yamlMetadata = parseContentYaml(session, detectContentYamlPath());
  const submissionMetadata = parseMetadataJson(opts.metadata);
  const workVersionMetadata = yamlMetadata?.raw
    ? {
        'frontmatter.myst': yamlMetadata.raw,
      }
    : undefined;
  const title = opts.title ?? yamlMetadata?.title;
  if (!title) {
    throw new Error('title is required (pass --title or set title in myst.yml/curvenote.yml)');
  }

  const venue = await ensureVenue(session, opts.venue, opts);
  await checkVenueExists(session, venue);

  const doi = yamlMetadata?.doi;
  let work: WorkDTO;
  let workVersionId: string;
  const existingWork = await resolveExistingWork(session, {
    mode: opts.key ?? 'id',
    key: yamlMetadata?.id,
    doi,
    fallbackCreateKey: yamlMetadata?.id,
    yes: opts.yes,
    forceNew: opts.new,
    contextLabel: 'register',
  });

  const tags = opts.tags && opts.tags.length > 0 ? opts.tags : undefined;
  if (existingWork) {
    const updated = await postNewWorkVersionFromMetadata(session, existingWork.links.versions, {
      title,
      description: yamlMetadata?.description,
      authors: yamlMetadata?.authors,
      author_details: yamlMetadata?.author_details,
      doi,
      date: yamlMetadata?.date,
      contains: opts.source ? [opts.source] : undefined,
      cdn: opts.cdn,
      cdn_key: opts.cdnKey,
      metadata: workVersionMetadata,
    });
    work = updated;
    workVersionId = updated.version_id as string;
  } else {
    work = await postNewWork(session, '', '', yamlMetadata?.id, {
      title,
      description: yamlMetadata?.description,
      authors: yamlMetadata?.authors,
      author_details: yamlMetadata?.author_details,
      doi,
      date: yamlMetadata?.date,
      contains: opts.source ? [opts.source] : undefined,
      cdn: opts.cdn,
      cdn_key: opts.cdnKey,
      metadata: workVersionMetadata,
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
      undefined,
      submissionMetadata,
      tags,
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
      undefined,
      submissionMetadata,
      tags,
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

  const workAction = existingWork ? 'Updated existing work' : 'Registered new work';
  session.log.info(`✅ ${workAction} with "${venue}"`);
  session.log.debug(`Work ID: ${work.id}`);
  session.log.debug(`Work Version ID: ${workVersionId}`);
  session.log.debug(`Submission ID: ${submissionId}`);
  session.log.debug(`Submission Version ID: ${submissionVersionId}`);
}
