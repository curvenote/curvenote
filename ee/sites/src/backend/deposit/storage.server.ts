import type { Context } from '@curvenote/scms-core';
import { File, KnownBuckets, StorageBackend } from '@curvenote/scms-server';

/** Deposited XML, kept for inspection. One object per attempt, named by Crossref's file_name. */
export function depositXmlKey(fileName: string) {
  return `crossref/deposits/${fileName}`;
}

export async function writePrivateXml(ctx: Context, key: string, xml: string) {
  const backend = new StorageBackend(ctx, [KnownBuckets.prv]);
  await new File(backend, key, KnownBuckets.prv).writeString(xml, 'application/xml');
}

export async function readPrivateXml(ctx: Context, key: string): Promise<string> {
  const backend = new StorageBackend(ctx, [KnownBuckets.prv]);
  const buffer = await new File(backend, key, KnownBuckets.prv).download();
  return buffer.toString('utf8');
}
