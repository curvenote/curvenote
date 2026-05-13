import type { ISession } from '../session/types.js';
import { postNewWork } from './push.js';
import type { RegisterWorkOpts } from './types.js';
import { postNewSubmission } from '../submissions/utils.js';
import { determineCollectionAndKind, getVenueCollections } from '../submissions/submit.utils.js';
import { checkVenueExists, ensureVenue } from '../sites/utils.js';
import { writeJsonLogs } from 'myst-cli';
import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';

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

  const work = await postNewWork(session, '', '', opts.key, {
    title,
    description: yamlMetadata?.description,
    authors: yamlMetadata?.authors,
    author_details: yamlMetadata?.author_details,
    doi: yamlMetadata?.doi,
    date: yamlMetadata?.date,
    contains: opts.source ? [opts.source] : undefined,
    metadata,
  });
  if (!work.version_id) {
    throw new Error('Failed to create a work version');
  }

  const collections = await getVenueCollections(session, venue);
  const { kind, collection } = await determineCollectionAndKind(session, venue, collections, {
    kind: opts.kind,
    collection: opts.collection,
    yes: opts.yes,
  });

  const submission = await postNewSubmission(
    session,
    venue,
    collection.id,
    kind.id,
    work.version_id,
    opts.draft ?? false,
  );

  writeJsonLogs(session, 'curvenote.work.register.json', {
    venue,
    work: { id: work.id, date_created: work.date_created },
    workVersion: { id: work.version_id, date_created: work.date_created },
    submission: { id: submission.id, date_created: submission.date_created },
    submissionVersion: { id: submission.active_version_id, date_created: submission.date_created },
  });

  session.log.info('✅ Blank work and submission records created.');
  session.log.info(`work=${work.id}`);
  session.log.info(`workVersion=${work.version_id}`);
  session.log.info(`submission=${submission.id}`);
  session.log.info(`submissionVersion=${submission.active_version_id}`);
}
