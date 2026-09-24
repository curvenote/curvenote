// Test-only helpers for the DOI service specs. Not imported by production code.
// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from 'vitest';
import type { DoiDeps } from './types.js';
import type { DoiConfigRow } from './db.server.js';

export const okPrefixBody = (name: string) =>
  JSON.stringify({ status: 'ok', message: { name, member: 'https://id.crossref.org/member/1' } });
export const roleOkBody = '<doi_batch_diagnostic status="unknown_submission" />';

type Reply = { status: number; body: string } | Error;

/** Answers fetch calls in order. The test asserts `calls` to see which URLs were hit. */
export function fakeFetch(...replies: Reply[]) {
  const queue = [...replies];
  // Parameters are declared so `mock.calls[n][0]` (the URL) and `[1]` (the init) are typed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) {
      throw new Error('fakeFetch: no reply left');
    }
    if (next instanceof Error) {
      throw next;
    }
    return new Response(next.body, { status: next.status });
  });
}

export function row(overrides: Partial<DoiConfigRow> = {}): DoiConfigRow {
  return {
    id: 'cfg-1',
    site_id: 'site-a',
    mode: 'CUSTOM_PREFIX',
    prefix: '10.5555',
    prefix_owner: 'Elemental Microscopy Society',
    role: null,
    status: 'PENDING_ROLE',
    occ: 0,
    ...overrides,
  };
}

/** A Prisma stand-in: `$transaction` runs the callback against the same mock. */
export function makeDeps(fetchMock: ReturnType<typeof fakeFetch> = fakeFetch()) {
  const prisma = {
    siteDoiConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    doiRegistration: { findFirst: vi.fn().mockResolvedValue(null) },
    submissionKind: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    submission: { findMany: vi.fn().mockResolvedValue([]) },
    activity: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const deps = {
    prisma,
    fetch: fetchMock,
    creds: {
      host: 'https://crossref.example.com',
      depositorEmail: 'doi@curvenote.com',
      password: 's3cret',
      prefix: '10.62329',
      role: 'curv',
      resourceUrlBase: 'https://doi.example.com',
    },
  } as unknown as DoiDeps;
  return { deps, prisma, fetchMock };
}

/** True when the test wrote nothing at all. */
export function wroteNothing(prisma: ReturnType<typeof makeDeps>['prisma']) {
  return (
    prisma.siteDoiConfig.create.mock.calls.length === 0 &&
    prisma.siteDoiConfig.update.mock.calls.length === 0 &&
    prisma.siteDoiConfig.delete.mock.calls.length === 0 &&
    prisma.activity.create.mock.calls.length === 0 &&
    prisma.submissionKind.updateMany.mock.calls.length === 0
  );
}
