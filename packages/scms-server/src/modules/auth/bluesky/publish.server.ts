/**
 * AT Protocol publishing: write MyST site content to a user's PDS using
 * standard.site lexicon records (site.standard.publication + site.standard.document)
 * and our com.curvenote.scms.workVersion manifest.
 *
 * All blobs (config, content JSONs, static assets) are uploaded directly to the PDS
 * so the final published content has zero references to Curvenote CDNs.
 */

import { Agent } from '@atproto/api';
import { httpError } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../backend/prisma.server.js';
import { getBlueskySessionForLinkedAccount } from './session-db.server.js';
import { getCachedBlueskyClient } from './register.server.js';
import { blueskySessionStore } from './stores.server.js';
/**
 * Generate a TID (Timestamp ID) compatible with AT Protocol.
 * TIDs are 13-character base32-sortable strings encoding microsecond timestamps.
 * Format: base32-sort encoded 64-bit number (53 bits timestamp + 10 bits clockid + 1 bit padding).
 */
function generateTid(): string {
  const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz';
  const micros = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  const clockId = BigInt(Math.floor(Math.random() * 1024));
  const tid = (micros << 10n) | clockId;
  let encoded = '';
  let val = tid;
  for (let i = 0; i < 13; i++) {
    encoded = S32_CHAR[Number(val & 31n)] + encoded;
    val >>= 5n;
  }
  return encoded;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type AtprotoPublishParams = {
  siteId: string;
  nominatedUserLinkedAccountId: string;
  submissionVersionId: string;
  payload: Record<string, unknown>;
};

export type AtprotoUnpublishParams = {
  siteId: string;
  nominatedUserLinkedAccountId: string;
  submissionVersionId: string;
  payload: Record<string, unknown>;
};

/** Result of a successful publish to AT Protocol */
export type AtprotoPublishResult = {
  publicationUri: string;
  publicationCid: string;
  documentUri: string;
  documentCid: string;
  workVersionUri: string;
  workVersionCid: string;
  blobCount: number;
};

type BlobRef = { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number };

// ── Validation ─────────────────────────────────────────────────────────────────

const ATPROTO_SITE_USER_REQUIRED_ERROR =
  'AT Protocol publishing requires a single nominated Bluesky user with an active session on this site.';

/**
 * Validate that AT Protocol publishing is configured with one valid Bluesky user
 * who is a member of the site and has an active persisted session.
 */
export async function assertAtprotoPublishingUser(params: {
  siteId: string;
  nominatedUserLinkedAccountId: string;
}): Promise<string> {
  const linkedAccountId = params.nominatedUserLinkedAccountId.trim();
  if (!linkedAccountId) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  const prisma = await getPrismaClient();
  const linkedAccount = await prisma.userLinkedAccount.findUnique({
    where: { id: linkedAccountId },
    select: { id: true, user_id: true, provider: true, pending: true },
  });
  if (!linkedAccount || linkedAccount.provider !== 'bluesky' || linkedAccount.pending) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  const siteMembership = await prisma.siteUser.findFirst({
    where: { site_id: params.siteId, user_id: linkedAccount.user_id },
    select: { id: true },
  });
  if (!siteMembership) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  const activeSession = await getBlueskySessionForLinkedAccount(linkedAccountId);
  if (!activeSession) {
    throw httpError(422, ATPROTO_SITE_USER_REQUIRED_ERROR);
  }

  return linkedAccountId;
}

// ── Session restoration ────────────────────────────────────────────────────────

/**
 * Restore an authenticated AT Protocol agent from a persisted session.
 *
 * Uses the NodeOAuthClient to properly restore the DPoP-bound session,
 * ensuring all token refresh and proof-of-possession headers are handled.
 * Falls back to direct Agent construction if the OAuth client is unavailable.
 */
async function restoreAtprotoAgent(linkedAccountId: string): Promise<{ agent: Agent; did: string }> {
  const session = await getBlueskySessionForLinkedAccount(linkedAccountId);
  if (!session) {
    throw httpError(422, 'No active Bluesky session found for the nominated user.');
  }

  const { sub: did, tokenSet, dpopJwk } = session;

  // Try to restore via the OAuth client (proper DPoP handling)
  const oauthClient = getCachedBlueskyClient();
  if (oauthClient) {
    // Load the persisted session back into the in-memory session store
    // so the OAuth client can find it
    await blueskySessionStore.set(did, { tokenSet, dpopJwk });

    try {
      const oauthSession = await oauthClient.restore(did);
      const agent = new Agent(oauthSession);
      return { agent, did };
    } catch (err) {
      console.warn(
        '[atproto/publish] OAuth client restore failed, falling back to direct agent:',
        err,
      );
    }
  }

  // Fallback: cannot proceed without OAuth client for DPoP-bound sessions
  throw httpError(
    500,
    'Bluesky OAuth client is not initialized. Ensure Bluesky auth is configured and the server has been started with Bluesky support enabled.',
  );
}

/**
 * Resolve the PDS endpoint for a DID by fetching the DID document.
 */
async function resolvePdsEndpoint(did: string): Promise<string> {
  // did:plc resolution
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${did}`);
    if (!res.ok) throw httpError(502, `Failed to resolve DID ${did}: ${res.status}`);
    const doc = (await res.json()) as { service?: { id: string; serviceEndpoint: string }[] };
    const pds = doc.service?.find((s) => s.id === '#atproto_pds');
    if (!pds) throw httpError(502, `No PDS endpoint in DID document for ${did}`);
    return pds.serviceEndpoint;
  }

  // did:web resolution
  if (did.startsWith('did:web:')) {
    const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
    const res = await fetch(`https://${domain}/.well-known/did.json`);
    if (!res.ok) throw httpError(502, `Failed to resolve DID ${did}: ${res.status}`);
    const doc = (await res.json()) as { service?: { id: string; serviceEndpoint: string }[] };
    const pds = doc.service?.find((s) => s.id === '#atproto_pds');
    if (!pds) throw httpError(502, `No PDS endpoint in DID document for ${did}`);
    return pds.serviceEndpoint;
  }

  throw httpError(422, `Unsupported DID method: ${did}`);
}

// ── CDN content fetching ───────────────────────────────────────────────────────

type CdnFile = { path: string; data: Buffer; contentType: string };

/**
 * Fetch all files for a work version from the CDN.
 * Returns the raw buffers with their logical paths and content types.
 */
async function fetchCdnContent(cdn: string, key: string): Promise<CdnFile[]> {
  const baseUrl = `${cdn.replace(/\/$/, '')}/${key.replace(/\./g, '/')}/`;
  const files: CdnFile[] = [];

  // 1. Fetch config.json - this is always present
  const configUrl = `${baseUrl}config.json`;
  const configRes = await fetch(configUrl);
  if (!configRes.ok) throw httpError(502, `Failed to fetch config.json from CDN: ${configRes.status}`);
  const configBuffer = Buffer.from(await configRes.arrayBuffer());
  files.push({ path: 'config.json', data: configBuffer, contentType: 'application/json' });

  // Parse config to discover content and public files
  const config = JSON.parse(configBuffer.toString('utf-8')) as {
    projects?: { slug?: string; index?: string; pages?: { slug: string }[] }[];
  };

  // 2. Fetch content JSON files for all pages
  const contentSlugs: { projectSlug?: string; slug: string }[] = [];
  for (const project of config.projects ?? []) {
    if (project.index) {
      contentSlugs.push({ projectSlug: project.slug || undefined, slug: project.index });
    }
    for (const page of project.pages ?? []) {
      contentSlugs.push({ projectSlug: project.slug || undefined, slug: page.slug });
    }
  }

  for (const { projectSlug, slug } of contentSlugs) {
    const contentPath = projectSlug ? `content/${projectSlug}/${slug}.json` : `content/${slug}.json`;
    const contentUrl = `${baseUrl}${contentPath}`;
    const contentRes = await fetch(contentUrl);
    if (contentRes.ok) {
      files.push({
        path: contentPath,
        data: Buffer.from(await contentRes.arrayBuffer()),
        contentType: 'application/json',
      });
    }
  }

  // 3. Discover and fetch static assets from config and content
  // Walk the config and all content JSONs to find asset URLs
  const assetPaths = new Set<string>();
  discoverAssetPaths(configBuffer.toString('utf-8'), baseUrl, assetPaths);
  for (const file of files) {
    if (file.path.startsWith('content/')) {
      discoverAssetPaths(file.data.toString('utf-8'), baseUrl, assetPaths);
    }
  }

  // Fetch all discovered assets
  for (const assetPath of assetPaths) {
    const assetUrl = `${baseUrl}${assetPath}`;
    try {
      const res = await fetch(assetUrl);
      if (res.ok) {
        const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
        files.push({
          path: assetPath,
          data: Buffer.from(await res.arrayBuffer()),
          contentType,
        });
      }
    } catch {
      console.warn(`[atproto/publish] Failed to fetch asset: ${assetPath}`);
    }
  }

  // 4. Fetch optional files
  for (const optionalFile of ['myst.xref.json', 'myst.search.json']) {
    const url = `${baseUrl}${optionalFile}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        files.push({
          path: optionalFile,
          data: Buffer.from(await res.arrayBuffer()),
          contentType: 'application/json',
        });
      }
    } catch {
      // Optional files can be missing
    }
  }

  return files;
}

/**
 * Walk a JSON string to discover relative asset paths (public/*, images, etc.)
 */
function discoverAssetPaths(json: string, baseUrl: string, paths: Set<string>): void {
  // Match URLs that reference our baseUrl with a public/ or similar path
  const baseEscaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const urlPattern = new RegExp(`${baseEscaped}(public/[^"\\s]+|[^"\\s]+\\.(?:png|jpg|jpeg|gif|svg|webp|css|js|woff2?|ttf|eot|pdf|mp4|webm))`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(json)) !== null) {
    paths.add(match[1]);
  }

  // Also look for relative paths in known fields
  const relativePattern = /"(?:url|src|href|thumbnail|thumbnailOptimized|banner|bannerOptimized|logo|logo_dark|favicon|urlOptimized|static)":\s*"(public\/[^"]+|[^"]*\/[^"]*\.(?:png|jpg|jpeg|gif|svg|webp|css|js|woff2?|ttf|eot|pdf))"/gi;
  while ((match = relativePattern.exec(json)) !== null) {
    const path = match[1];
    // Skip absolute URLs
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      paths.add(path);
    }
  }
}

// ── Blob upload ────────────────────────────────────────────────────────────────

/**
 * Upload a file as a blob to the user's PDS via the agent.
 * Returns the blob reference that can be embedded in records.
 */
async function uploadBlob(
  agent: Agent,
  data: Buffer | Uint8Array,
  contentType: string,
): Promise<BlobRef> {
  const res = await agent.com.atproto.repo.uploadBlob(data, { encoding: contentType });
  return res.data.blob as unknown as BlobRef;
}

// ── URL rewriting ──────────────────────────────────────────────────────────────

type BlobMap = Map<string, BlobRef>;

/**
 * Rewrite all CDN URLs in a JSON object tree to use AT Protocol blob references.
 *
 * For MyST AST content, this replaces image URLs, static file URLs, and other
 * CDN references with `at://{did}/blob/{cid}` URIs that resolve directly from
 * the user's PDS.
 */
function rewriteCdnUrls(
  obj: unknown,
  cdnBaseUrl: string,
  blobMap: BlobMap,
  pdsEndpoint: string,
  did: string,
): unknown {
  if (typeof obj === 'string') {
    // Check if this string is a CDN URL we can rewrite
    if (obj.startsWith(cdnBaseUrl)) {
      const relativePath = obj.slice(cdnBaseUrl.length);
      const blobRef = blobMap.get(relativePath);
      if (blobRef) {
        // Use the PDS blob endpoint for direct access
        const cid = blobRef.ref.$link;
        return `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => rewriteCdnUrls(item, cdnBaseUrl, blobMap, pdsEndpoint, did));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = rewriteCdnUrls(value, cdnBaseUrl, blobMap, pdsEndpoint, did);
    }
    return result;
  }

  return obj;
}

// ── Record management ──────────────────────────────────────────────────────────

/**
 * Find an existing record of a given type, or return null if none exists.
 */
async function findExistingRecord(
  agent: Agent,
  did: string,
  collection: string,
  matchFn: (record: Record<string, unknown>) => boolean,
): Promise<{ uri: string; cid: string; rkey: string } | null> {
  try {
    const res = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection,
      limit: 100,
    });
    for (const record of res.data.records) {
      if (matchFn(record.value as Record<string, unknown>)) {
        return { uri: record.uri, cid: record.cid, rkey: record.uri.split('/').pop()! };
      }
    }
  } catch {
    // Collection may not exist yet
  }
  return null;
}

// ── Publish ────────────────────────────────────────────────────────────────────

/**
 * Publish a MyST site submission to the user's PDS using AT Protocol.
 *
 * Flow:
 * 1. Restore authenticated agent from persisted session
 * 2. Fetch all MyST content from our CDN (config, content, public assets)
 * 3. Upload all files as blobs to the user's PDS
 * 4. Rewrite CDN URLs in content to point to PDS blob endpoints
 * 5. Re-upload rewritten content (with PDS-local URLs)
 * 6. Create/update site.standard.publication record
 * 7. Create/update site.standard.document record
 * 8. Create com.curvenote.scms.workVersion manifest record
 */
export async function publishToAtproto(params: AtprotoPublishParams): Promise<AtprotoPublishResult> {
  const { siteId, nominatedUserLinkedAccountId, submissionVersionId, payload } = params;
  const cdn = payload.cdn as string;
  const key = payload.key as string;

  if (!cdn || !key) {
    throw httpError(422, 'Missing cdn or key in publish payload');
  }

  console.log(`[atproto/publish] Starting publish for site=${siteId} sv=${submissionVersionId}`);

  // 1. Validate and restore agent
  await assertAtprotoPublishingUser({ siteId, nominatedUserLinkedAccountId });
  const { agent, did } = await restoreAtprotoAgent(nominatedUserLinkedAccountId);

  const pdsEndpoint = await resolvePdsEndpoint(did);
  const cdnBaseUrl = `${cdn.replace(/\/$/, '')}/${key.replace(/\./g, '/')}/`;

  // 2. Load site metadata from DB
  const prisma = await getPrismaClient();
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true, title: true, description: true },
  });
  if (!site) throw httpError(404, 'Site not found');

  // Load submission metadata
  const submissionVersion = await prisma.submissionVersion.findUnique({
    where: { id: submissionVersionId },
    include: {
      work_version: { select: { id: true, title: true, description: true, work_id: true } },
      submission: { select: { id: true, slugs: { where: { primary: true }, take: 1 } } },
    },
  });
  if (!submissionVersion) throw httpError(404, 'Submission version not found');

  // 3. Fetch all content from CDN
  console.log(`[atproto/publish] Fetching content from CDN: ${cdnBaseUrl}`);
  const files = await fetchCdnContent(cdn, key);
  console.log(`[atproto/publish] Fetched ${files.length} files from CDN`);

  // 4. Upload all files as blobs (first pass - originals for public assets)
  const blobMap: BlobMap = new Map();
  let blobCount = 0;

  for (const file of files) {
    try {
      const blobRef = await uploadBlob(agent, file.data, file.contentType);
      blobMap.set(file.path, blobRef);
      blobCount++;
    } catch (err) {
      console.error(`[atproto/publish] Failed to upload blob for ${file.path}:`, err);
      throw httpError(502, `Failed to upload blob to PDS: ${file.path}`);
    }
  }
  console.log(`[atproto/publish] Uploaded ${blobCount} blobs to PDS`);

  // 5. Rewrite CDN URLs in config and content, then re-upload those
  const configFile = files.find((f) => f.path === 'config.json');
  if (!configFile) throw httpError(500, 'config.json not found in CDN content');

  const rewrittenConfig = rewriteCdnUrls(
    JSON.parse(configFile.data.toString('utf-8')),
    cdnBaseUrl,
    blobMap,
    pdsEndpoint,
    did,
  );
  const rewrittenConfigBuffer = Buffer.from(JSON.stringify(rewrittenConfig), 'utf-8');
  const configBlobRef = await uploadBlob(agent, rewrittenConfigBuffer, 'application/json');
  blobMap.set('config.json', configBlobRef);
  blobCount++;

  // Rewrite and re-upload content JSONs
  const contentItems: { path: string; blob: BlobRef }[] = [];
  for (const file of files) {
    if (file.path.startsWith('content/') && file.path.endsWith('.json')) {
      const originalContent = JSON.parse(file.data.toString('utf-8'));
      const rewrittenContent = rewriteCdnUrls(
        originalContent,
        cdnBaseUrl,
        blobMap,
        pdsEndpoint,
        did,
      );
      const rewrittenBuffer = Buffer.from(JSON.stringify(rewrittenContent), 'utf-8');
      const contentBlobRef = await uploadBlob(agent, rewrittenBuffer, 'application/json');
      contentItems.push({ path: file.path, blob: contentBlobRef });
      blobCount++;
    }
  }

  // Collect public asset items
  const publicItems: { path: string; blob: BlobRef }[] = [];
  for (const file of files) {
    if (
      file.path.startsWith('public/') ||
      (!file.path.startsWith('content/') && file.path !== 'config.json')
    ) {
      const blobRef = blobMap.get(file.path);
      if (blobRef) {
        publicItems.push({ path: file.path, blob: blobRef });
      }
    }
  }

  // 6. Create or update site.standard.publication record
  const siteUrl = `https://${site.name}.curve.space`;
  const existingPub = await findExistingRecord(
    agent,
    did,
    'site.standard.publication',
    (r) => r.url === siteUrl || r.name === site.title,
  );

  let publicationUri: string;
  let publicationCid: string;

  const publicationRecord = {
    $type: 'site.standard.publication',
    url: siteUrl,
    name: site.title || site.name,
    description: site.description || undefined,
  };

  if (existingPub) {
    // Update existing publication
    const res = await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: 'site.standard.publication',
      rkey: existingPub.rkey,
      record: publicationRecord,
    });
    publicationUri = res.data.uri;
    publicationCid = res.data.cid;
  } else {
    const res = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: 'site.standard.publication',
      rkey: generateTid(),
      record: publicationRecord,
    });
    publicationUri = res.data.uri;
    publicationCid = res.data.cid;
  }
  console.log(`[atproto/publish] Publication record: ${publicationUri}`);

  // 7. Create or update site.standard.document record
  const slug =
    submissionVersion.submission.slugs[0]?.slug ?? submissionVersion.work_version.work_id;
  const title = submissionVersion.work_version.title ?? 'Untitled';
  const description = submissionVersion.work_version.description ?? undefined;
  const now = new Date().toISOString();

  const existingDoc = await findExistingRecord(
    agent,
    did,
    'site.standard.document',
    (r) =>
      r.site === siteUrl &&
      (r.path === `/articles/${slug}` || r.title === title),
  );

  let documentUri: string;
  let documentCid: string;

  const documentRecord: Record<string, unknown> = {
    $type: 'site.standard.document',
    site: siteUrl,
    title,
    path: `/articles/${slug}`,
    description,
    publishedAt: submissionVersion.date_published?.toISOString?.() ?? now,
    updatedAt: now,
    content: {
      $type: 'com.curvenote.content.myst',
      workVersionRef: `at://${did}/com.curvenote.scms.workVersion/${submissionVersionId}`,
    },
  };

  if (existingDoc) {
    const res = await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: 'site.standard.document',
      rkey: existingDoc.rkey,
      record: documentRecord,
    });
    documentUri = res.data.uri;
    documentCid = res.data.cid;
  } else {
    const res = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: 'site.standard.document',
      rkey: generateTid(),
      record: documentRecord,
    });
    documentUri = res.data.uri;
    documentCid = res.data.cid;
  }
  console.log(`[atproto/publish] Document record: ${documentUri}`);

  // 8. Create com.curvenote.scms.workVersion manifest
  const workVersionRecord = {
    $type: 'com.curvenote.scms.workVersion',
    config: configBlobRef,
    content: contentItems,
    public: publicItems,
    version: submissionVersion.work_version.id,
    schemaVersion: '1.0',
    siteSchema: 'site.standard.publication',
    site: {
      uri: publicationUri,
      cid: publicationCid,
    },
    submissionSchema: 'site.standard.document',
    submission: {
      uri: documentUri,
      cid: documentCid,
    },
    createdAt: now,
  };

  // Use submission version ID as rkey for easy lookup
  const existingWv = await findExistingRecord(
    agent,
    did,
    'com.curvenote.scms.workVersion',
    (r) => r.version === submissionVersion.work_version.id,
  );

  let workVersionUri: string;
  let workVersionCid: string;

  if (existingWv) {
    const res = await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: 'com.curvenote.scms.workVersion',
      rkey: existingWv.rkey,
      record: workVersionRecord,
    });
    workVersionUri = res.data.uri;
    workVersionCid = res.data.cid;
  } else {
    const res = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: 'com.curvenote.scms.workVersion',
      rkey: generateTid(),
      record: workVersionRecord,
    });
    workVersionUri = res.data.uri;
    workVersionCid = res.data.cid;
  }
  console.log(`[atproto/publish] WorkVersion record: ${workVersionUri}`);

  // 9. Store the atproto record URIs on the submission version for future reference
  try {
    await prisma.submissionVersion.update({
      where: { id: submissionVersionId },
      data: {
        metadata: {
          atproto: {
            publicationUri,
            publicationCid,
            documentUri,
            documentCid,
            workVersionUri,
            workVersionCid,
            did,
            publishedAt: now,
          },
        },
      },
    });
  } catch (err) {
    console.warn('[atproto/publish] Failed to store atproto metadata on submission version', err);
  }

  console.log(
    `[atproto/publish] Publish complete: ${blobCount} blobs, publication=${publicationUri}, document=${documentUri}`,
  );

  return {
    publicationUri,
    publicationCid,
    documentUri,
    documentCid,
    workVersionUri,
    workVersionCid,
    blobCount,
  };
}

// ── Unpublish ──────────────────────────────────────────────────────────────────

/**
 * Remove published content from the user's PDS.
 *
 * Deletes the workVersion manifest and the document record.
 * The publication record is kept (it represents the site, not individual articles).
 */
export async function unpublishFromAtproto(params: AtprotoUnpublishParams): Promise<void> {
  const { siteId, nominatedUserLinkedAccountId, submissionVersionId } = params;

  console.log(`[atproto/unpublish] Starting unpublish for site=${siteId} sv=${submissionVersionId}`);

  await assertAtprotoPublishingUser({ siteId, nominatedUserLinkedAccountId });
  const { agent, did } = await restoreAtprotoAgent(nominatedUserLinkedAccountId);

  // Load stored atproto metadata from the submission version
  const prisma = await getPrismaClient();
  const sv = await prisma.submissionVersion.findUnique({
    where: { id: submissionVersionId },
    select: { metadata: true, work_version: { select: { id: true, title: true, work_id: true } } },
  });

  const metadata = sv?.metadata as { atproto?: Record<string, string> } | null;
  const atprotoMeta = metadata?.atproto;

  // Delete workVersion record
  if (atprotoMeta?.workVersionUri) {
    const rkey = atprotoMeta.workVersionUri.split('/').pop();
    if (rkey) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: did,
          collection: 'com.curvenote.scms.workVersion',
          rkey,
        });
        console.log(`[atproto/unpublish] Deleted workVersion: ${atprotoMeta.workVersionUri}`);
      } catch (err) {
        console.warn(`[atproto/unpublish] Failed to delete workVersion record:`, err);
      }
    }
  } else if (sv?.work_version) {
    // Fallback: search for the record
    const existing = await findExistingRecord(
      agent,
      did,
      'com.curvenote.scms.workVersion',
      (r) => r.version === sv.work_version.id,
    );
    if (existing) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: did,
          collection: 'com.curvenote.scms.workVersion',
          rkey: existing.rkey,
        });
        console.log(`[atproto/unpublish] Deleted workVersion (by search): ${existing.uri}`);
      } catch (err) {
        console.warn(`[atproto/unpublish] Failed to delete workVersion record:`, err);
      }
    }
  }

  // Delete document record
  if (atprotoMeta?.documentUri) {
    const rkey = atprotoMeta.documentUri.split('/').pop();
    if (rkey) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: did,
          collection: 'site.standard.document',
          rkey,
        });
        console.log(`[atproto/unpublish] Deleted document: ${atprotoMeta.documentUri}`);
      } catch (err) {
        console.warn(`[atproto/unpublish] Failed to delete document record:`, err);
      }
    }
  } else if (sv?.work_version) {
    // Fallback: search
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { name: true },
    });
    const siteUrl = `https://${site?.name}.curve.space`;
    const existing = await findExistingRecord(
      agent,
      did,
      'site.standard.document',
      (r) => r.site === siteUrl && r.title === sv.work_version.title,
    );
    if (existing) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: did,
          collection: 'site.standard.document',
          rkey: existing.rkey,
        });
        console.log(`[atproto/unpublish] Deleted document (by search): ${existing.uri}`);
      } catch (err) {
        console.warn(`[atproto/unpublish] Failed to delete document record:`, err);
      }
    }
  }

  // Clear atproto metadata from submission version
  try {
    await prisma.submissionVersion.update({
      where: { id: submissionVersionId },
      data: { metadata: {} },
    });
  } catch {
    // Non-critical
  }

  console.log(`[atproto/unpublish] Unpublish complete for sv=${submissionVersionId}`);
}
