# Submission Tags Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a site admin create, assign, remove and see editorial tags on a submission, and expose them on two read endpoints.

**Architecture:** A site-scoped `Tag` table joins `Submission` through an explicit `TagsInSubmissions` table. Read and write helpers live in `@curvenote/scms-server` so the API routes and the site-admin route action share them. The site-admin details page mutates through its own `action`; no new v1 write endpoint.

**Tech Stack:** TypeScript, Prisma + Postgres, React Router 7, vitest, Tailwind, radix primitives, bun + turbo.

**Spec:** `docs/superpowers/specs/2026-08-27-submission-tags-design.md`

## Global Constraints

- Copy and identifiers use **tags**: table `Tag`, relation `Submission.tags`, UI copy "Tags".
- Editorial tags never go into `SiteWorkDTO.tags`. That field stays version tags.
- The published payload field is `submission_tags`.
- `name` is URL-safe, lowercase, `a-z0-9-_`, 3 characters or more, derived from `label`.
- `formatSiteWorkDTO`, `siteWorkDtoSelect` and `siteWorkSubmissionSelect` must not change.
- Every mutation is guarded by `scopes.site.submissions.update`.
- Removing a tag from a submission never deletes the `Tag` row.
- All code, comments and commit messages in English.
- Commit messages use the repo's emoji prefix style (`✨`, `🧪`, `♻️`, `📝`).

---

### Task 0: Working test loop

**Files:**
- Modify: `ee/sites/package.json` (scripts block, after `"lint:circular"`)

**Interfaces:**
- Consumes: nothing
- Produces: `bun --cwd ee/sites run test` runs the ee/sites specs; `bun run test` picks them up through turbo.

- [ ] **Step 1: Install and build the workspace**

This worktree has no `node_modules`.

```bash
bun run install:workspace
bun run build:scms
```

- [ ] **Step 2: Start the database and reset the test schema**

```bash
bun run dx:up
bun --cwd platform/scms run test:db:reset
```

- [ ] **Step 3: Confirm ee/sites specs do not run today**

```bash
bun run test 2>&1 | grep -c "scms-sites-ext"
```

Expected: `0`. The package has `vitest` as a dependency but no `test` script, so turbo skips it.

- [ ] **Step 4: Add the test script**

In `ee/sites/package.json`, inside `"scripts"`:

```json
    "test": "vitest run",
```

- [ ] **Step 5: Run the ee/sites specs**

```bash
bun --cwd ee/sites run test
```

Expected: PASS. If a spec fails on module resolution, re-run `bun run build:scms` first — the specs import built workspace packages.

- [ ] **Step 6: Commit**

```bash
git add ee/sites/package.json
git commit -m "🧪 Run the sites extension specs in CI"
```

---

### Task 1: Tag and TagsInSubmissions tables

**Files:**
- Modify: `prisma/schema/submission.prisma`
- Modify: `prisma/schema/site.prisma:26-56` (the `Site` model, add the `tags` relation)
- Modify: `prisma/schema/activity.prisma:1-41` (the `ActivityType` enum)
- Create: `prisma/schema/migrations/<timestamp>_add_submission_tags/migration.sql` (generated)
- Test: `platform/scms/tests/integration/workflow/submission-tags.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `prisma.tag`, `prisma.tagsInSubmissions`, `ActivityType.SUBMISSION_TAGS_CHANGE`.

- [ ] **Step 1: Write the failing test**

Create `platform/scms/tests/integration/workflow/submission-tags.spec.ts`:

```ts
/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import { createTestData, type TestData } from '../helpers/mocks';
import { uuidv7 } from 'uuidv7';

describe('Submission tags schema', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('a tag is site scoped and joins a submission', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();

    const tag = await prisma.tag.create({
      data: {
        id: uuidv7(),
        name: 'blog-post',
        label: 'Blog Post',
        date_created: now,
        site: { connect: { id: testData.siteId } },
      },
    });

    await prisma.tagsInSubmissions.create({
      data: {
        id: uuidv7(),
        date_created: now,
        tag: { connect: { id: tag.id } },
        submission: { connect: { id: testData.submissionId } },
      },
    });

    const submission = await prisma.submission.findUniqueOrThrow({
      where: { id: testData.submissionId },
      select: { tags: { select: { tag: { select: { name: true, label: true } } } } },
    });

    expect(submission.tags).toEqual([{ tag: { name: 'blog-post', label: 'Blog Post' } }]);
  });

  test('the same name cannot be used twice on one site', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();
    const data = {
      name: 'blog-post',
      label: 'Blog Post',
      date_created: now,
      site: { connect: { id: testData.siteId } },
    };

    await prisma.tag.create({ data: { id: uuidv7(), ...data } });

    await expect(prisma.tag.create({ data: { id: uuidv7(), ...data } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd platform/scms run test:integration 2>&1 | tail -30
```

Expected: FAIL — `prisma.tag` is undefined.

- [ ] **Step 3: Add the models**

Append to `prisma/schema/submission.prisma`:

```prisma
/// Editorial tag on a submission. Site scoped, created from the site-admin
/// submission details page. NOT the version tags on `SubmissionVersion.tags`.
model Tag {
  id           String              @id
  /// URL-safe, lowercase, 3 characters or more. Derived from `label`.
  name         String
  /// Human display string, e.g. "Blog Post".
  label        String
  date_created String
  site         Site                @relation(fields: [site_id], references: [id])
  site_id      String
  submissions  TagsInSubmissions[]

  @@unique([name, site_id])
}

/// Join row between a submission and an editorial tag. Created or deleted,
/// never updated, so it carries no `date_modified`.
model TagsInSubmissions {
  id            String     @id
  date_created  String
  tag           Tag        @relation(fields: [tag_id], references: [id], onDelete: Cascade)
  tag_id        String
  submission    Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  submission_id String

  @@unique([submission_id, tag_id])
  @@index([tag_id])
}
```

In the same file, add to `model Submission` beside `slugs`:

```prisma
  tags            TagsInSubmissions[]
```

In `prisma/schema/site.prisma`, add to `model Site` beside `collections`:

```prisma
  tags               Tag[]
```

In `prisma/schema/activity.prisma`, add to `enum ActivityType` after `SUBMISSION_DATE_CHANGE`:

```prisma
  SUBMISSION_TAGS_CHANGE
```

- [ ] **Step 4: Generate the migration**

```bash
bun run prisma:format
bun run dev:db:migrate --name add_submission_tags
```

Check the generated `migration.sql`: it must create both tables, both unique indexes, and `ALTER TYPE "ActivityType" ADD VALUE 'SUBMISSION_TAGS_CHANGE'`.

- [ ] **Step 5: Reset the test database and run the test**

```bash
bun --cwd platform/scms run test:db:reset
bun --cwd platform/scms run test:integration 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema platform/scms/tests/integration/workflow/submission-tags.spec.ts
git commit -m "✨ Add Tag and TagsInSubmissions tables"
```

---

### Task 2: Tag name derivation

**Files:**
- Create: `packages/scms-core/src/utils/tagName.ts`
- Create: `packages/scms-core/src/utils/tagName.spec.ts`
- Modify: `packages/scms-core/src/utils/index.ts` (export block near `export * from './status.js';`)

**Interfaces:**
- Consumes: nothing
- Produces: `toTagName(label: string): string`, `isValidTagName(name: string): boolean`, `TAG_NAME_MIN_LENGTH: number`, all re-exported from `@curvenote/scms-core`.

- [ ] **Step 1: Write the failing test**

Create `packages/scms-core/src/utils/tagName.spec.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { toTagName, isValidTagName, TAG_NAME_MIN_LENGTH } from './tagName.js';

describe('toTagName', () => {
  test.each([
    ['Blog Post', 'blog-post'],
    ['  Editors   Pick  ', 'editors-pick'],
    ['Café Society', 'cafe-society'],
    ['R&D / Notes', 'r-d-notes'],
    ['snake_case_ok', 'snake_case_ok'],
    ['--Leading and trailing--', 'leading-and-trailing'],
    ['', ''],
  ])('%s becomes %s', (label, expected) => {
    expect(toTagName(label)).toBe(expected);
  });
});

describe('isValidTagName', () => {
  test('accepts a derived name of at least the minimum length', () => {
    expect(TAG_NAME_MIN_LENGTH).toBe(3);
    expect(isValidTagName('blog-post')).toBe(true);
    expect(isValidTagName('abc')).toBe(true);
  });

  test.each(['ab', '', '-abc', 'Blog Post', 'blog.post'])('rejects %s', (name) => {
    expect(isValidTagName(name)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd packages/scms-core run test src/utils/tagName.spec.ts
```

Expected: FAIL — cannot resolve `./tagName.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/scms-core/src/utils/tagName.ts`:

```ts
/** Shortest accepted editorial tag name. */
export const TAG_NAME_MIN_LENGTH = 3;

/**
 * Derive the URL-safe `name` of an editorial tag from its human `label`.
 *
 * "Blog Post" becomes "blog-post". Accents are folded, other characters are
 * removed, and separators are collapsed and trimmed.
 */
export function toTagName(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

/** True when `name` is safe to store as `Tag.name`. */
export function isValidTagName(name: string): boolean {
  if (name.length < TAG_NAME_MIN_LENGTH) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(name);
}
```

- [ ] **Step 4: Export it**

In `packages/scms-core/src/utils/index.ts`, beside the other re-exports:

```ts
export * from './tagName.js';
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun --cwd packages/scms-core run test src/utils/tagName.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/scms-core/src/utils/tagName.ts packages/scms-core/src/utils/tagName.spec.ts packages/scms-core/src/utils/index.ts
git commit -m "✨ Derive editorial tag names from labels"
```

---

### Task 3: TagDTO and the tag loaders

**Files:**
- Modify: `packages/common/src/types/index.ts` (beside `CollectionSummaryDTO`, around line 86)
- Create: `packages/scms-server/src/backend/loaders/sites/tags/format.server.ts`
- Create: `packages/scms-server/src/backend/loaders/sites/tags/format.server.spec.ts`
- Create: `packages/scms-server/src/backend/loaders/sites/tags/list.server.ts`
- Create: `packages/scms-server/src/backend/loaders/sites/tags/index.ts`
- Modify: `packages/scms-server/src/backend/loaders/sites/index.ts:1-5`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TagDTO = { id: string; name: string; label: string }` from `@curvenote/common`
  - `TagRow = { id: string; name: string; label: string }`
  - `formatTagDTO(row: TagRow): TagDTO`
  - `dbListSiteTags(siteId: string): Promise<TagRow[]>`
  - `dbListTagsForSubmission(submissionId: string): Promise<TagRow[]>`
  - namespace `sites.tags` on `@curvenote/scms-server`

- [ ] **Step 1: Write the failing test**

Create `packages/scms-server/src/backend/loaders/sites/tags/format.server.spec.ts`:

```ts
/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatTagDTO } from './format.server.js';

describe('formatTagDTO', () => {
  test('returns id, name and label only', () => {
    const dto = formatTagDTO({
      id: 'tag1',
      name: 'blog-post',
      label: 'Blog Post',
      site_id: 'site1',
      date_created: '2026-08-27T00:00:00.000Z',
    } as never);

    expect(dto).toEqual({ id: 'tag1', name: 'blog-post', label: 'Blog Post' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd packages/scms-server run test src/backend/loaders/sites/tags/format.server.spec.ts
```

Expected: FAIL — cannot resolve `./format.server.js`.

- [ ] **Step 3: Add the DTO type**

In `packages/common/src/types/index.ts`, directly above `export type CollectionSummaryDTO`:

```ts
/**
 * Editorial tag on a submission. Site scoped. NOT the version tags carried by
 * `SiteWorkDTO.tags`.
 */
export type TagDTO = {
  id: string;
  name: string;
  label: string;
};
```

- [ ] **Step 4: Write the formatter**

Create `packages/scms-server/src/backend/loaders/sites/tags/format.server.ts`:

```ts
import type { TagDTO } from '@curvenote/common';

/** Fields read by {@link formatTagDTO}. */
export type TagRow = { id: string; name: string; label: string };

export function formatTagDTO(row: TagRow): TagDTO {
  return { id: row.id, name: row.name, label: row.label };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun --cwd packages/scms-server run test src/backend/loaders/sites/tags/format.server.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Write the list loaders**

Create `packages/scms-server/src/backend/loaders/sites/tags/list.server.ts`:

```ts
import { getPrismaClient } from '../../../prisma.server.js';
import type { TagRow } from './format.server.js';

const TAG_SELECT = { id: true, name: true, label: true } as const;

/** Every tag defined on the site, assigned or not, ordered by label. */
export async function dbListSiteTags(siteId: string): Promise<TagRow[]> {
  const prisma = await getPrismaClient();
  return prisma.tag.findMany({
    where: { site_id: siteId },
    select: TAG_SELECT,
    orderBy: { label: 'asc' },
  });
}

/** Tags assigned to one submission, ordered by label. */
export async function dbListTagsForSubmission(submissionId: string): Promise<TagRow[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.tagsInSubmissions.findMany({
    where: { submission_id: submissionId },
    select: { tag: { select: TAG_SELECT } },
    orderBy: { tag: { label: 'asc' } },
  });
  return rows.map((row) => row.tag);
}
```

- [ ] **Step 7: Export the namespace**

Create `packages/scms-server/src/backend/loaders/sites/tags/index.ts`:

```ts
export * from './format.server.js';
export * from './list.server.js';
```

In `packages/scms-server/src/backend/loaders/sites/index.ts`, beside the other namespaces:

```ts
export * as tags from './tags/index.js';
```

- [ ] **Step 8: Check types**

```bash
bun --cwd packages/scms-server run compile
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/common/src/types/index.ts packages/scms-server/src/backend/loaders/sites/tags packages/scms-server/src/backend/loaders/sites/index.ts
git commit -m "✨ Add TagDTO and the site tag loaders"
```

---

### Task 4: Assign and remove helpers

**Files:**
- Create: `packages/scms-server/src/backend/loaders/sites/tags/assign.server.ts`
- Modify: `packages/scms-server/src/backend/loaders/sites/tags/index.ts`
- Test: `platform/scms/tests/integration/workflow/submission-tags.spec.ts` (extend)

**Interfaces:**
- Consumes: `TagDTO`, `formatTagDTO`, `toTagName`, `isValidTagName`
- Produces:
  - `assignTagToSubmission(params: { siteId: string; submissionId: string; userId: string; input: { tagId: string } | { label: string } }): Promise<TagDTO>`
  - `removeTagFromSubmission(params: { siteId: string; submissionId: string; userId: string; tagId: string }): Promise<TagDTO>`

Both take plain ids, not a `SiteContext`, so the integration tests can call them directly.

- [ ] **Step 1: Write the failing tests**

Append to `platform/scms/tests/integration/workflow/submission-tags.spec.ts`:

```ts
describe('assignTagToSubmission', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('creates the tag from a label and assigns it', async () => {
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    expect(dto).toMatchObject({ name: 'blog-post', label: 'Blog Post' });

    const assigned = await sites.tags.dbListTagsForSubmission(testData.submissionId);
    expect(assigned).toEqual([dto]);
  });

  test('reuses an existing tag with the same derived name', async () => {
    const first = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    const second = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'blog post' },
    });

    expect(second.id).toBe(first.id);
    const catalog = await sites.tags.dbListSiteTags(testData.siteId);
    expect(catalog).toHaveLength(1);
  });

  test('a repeated assignment does not duplicate the join row', async () => {
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { tagId: dto.id },
    });

    const assigned = await sites.tags.dbListTagsForSubmission(testData.submissionId);
    expect(assigned).toHaveLength(1);
  });

  test('rejects a short label', async () => {
    // `httpError` rejects with a Response, not an Error, so assert on status.
    await expect(
      sites.tags.assignTagToSubmission({
        siteId: testData.siteId,
        submissionId: testData.submissionId,
        userId: testData.userId,
        input: { label: 'ab' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects a tag from another site', async () => {
    const other = await createTestData('ADMIN' as SiteRole);
    const foreign = await sites.tags.assignTagToSubmission({
      siteId: other.siteId,
      submissionId: other.submissionId,
      userId: other.userId,
      input: { label: 'Blog Post' },
    });

    await expect(
      sites.tags.assignTagToSubmission({
        siteId: testData.siteId,
        submissionId: testData.submissionId,
        userId: testData.userId,
        input: { tagId: foreign.id },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('writes one SUBMISSION_TAGS_CHANGE activity per change', async () => {
    const prisma = await getPrismaClient();
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    await sites.tags.removeTagFromSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: dto.id,
    });

    const activity = await prisma.activity.findMany({
      where: { submission_id: testData.submissionId, activity_type: 'SUBMISSION_TAGS_CHANGE' },
      orderBy: { date_created: 'asc' },
      select: { data: true },
    });

    expect(activity).toHaveLength(2);
    expect(activity[0].data).toMatchObject({ action: 'added', tag: { name: 'blog-post' } });
    expect(activity[1].data).toMatchObject({ action: 'removed', tag: { name: 'blog-post' } });
  });
});

describe('removeTagFromSubmission', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('removes the assignment and keeps the tag in the catalog', async () => {
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    await sites.tags.removeTagFromSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: dto.id,
    });

    expect(await sites.tags.dbListTagsForSubmission(testData.submissionId)).toEqual([]);
    expect(await sites.tags.dbListSiteTags(testData.siteId)).toEqual([dto]);
  });
});
```

Update the import at the top of the file:

```ts
import { getPrismaClient, sites } from '@curvenote/scms-server';
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bun --cwd platform/scms run test:integration 2>&1 | tail -30
```

Expected: FAIL — `sites.tags.assignTagToSubmission is not a function`.

- [ ] **Step 3: Write the implementation**

Create `packages/scms-server/src/backend/loaders/sites/tags/assign.server.ts`:

```ts
import type { TagDTO } from '@curvenote/common';
import { isValidTagName, toTagName, httpError } from '@curvenote/scms-core';
import { ActivityType } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatTagDTO, type TagRow } from './format.server.js';

const TAG_SELECT = { id: true, name: true, label: true } as const;

export type AssignTagInput = { tagId: string } | { label: string };

export type AssignTagParams = {
  siteId: string;
  submissionId: string;
  userId: string;
  input: AssignTagInput;
};

export type RemoveTagParams = {
  siteId: string;
  submissionId: string;
  userId: string;
  tagId: string;
};

async function assertSubmissionOnSite(siteId: string, submissionId: string) {
  const prisma = await getPrismaClient();
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, site_id: siteId },
    select: { id: true },
  });
  if (!submission) throw httpError(404, 'submission not found on this site');
}

/**
 * Find the site tag for `tagId`, or create it from `label`.
 *
 * Creation is idempotent: the derived name is unique per site, so a concurrent
 * create raises P2002 and we read the winning row instead of failing.
 */
async function resolveTag(siteId: string, input: AssignTagInput): Promise<TagRow> {
  const prisma = await getPrismaClient();

  if ('tagId' in input) {
    const tag = await prisma.tag.findFirst({
      where: { id: input.tagId, site_id: siteId },
      select: TAG_SELECT,
    });
    if (!tag) throw httpError(404, 'tag not found on this site');
    return tag;
  }

  const label = input.label.trim();
  const name = toTagName(label);
  if (!isValidTagName(name)) {
    throw httpError(400, `invalid tag name derived from label: "${label}"`);
  }

  try {
    return await prisma.tag.create({
      data: {
        id: uuidv7(),
        name,
        label,
        date_created: new Date().toISOString(),
        site: { connect: { id: siteId } },
      },
      select: TAG_SELECT,
    });
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e;
    return prisma.tag.findFirstOrThrow({
      where: { name, site_id: siteId },
      select: TAG_SELECT,
    });
  }
}

async function recordTagActivity(
  submissionId: string,
  userId: string,
  tag: TagRow,
  action: 'added' | 'removed',
) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  await prisma.activity.create({
    data: {
      id: uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      activity_type: ActivityType.SUBMISSION_TAGS_CHANGE,
      activity_by: { connect: { id: userId } },
      submission: { connect: { id: submissionId } },
      data: { action, tag: { id: tag.id, name: tag.name, label: tag.label } },
    },
    select: { id: true },
  });
}

/** Assign an existing tag, or create one from a label and assign it. */
export async function assignTagToSubmission(params: AssignTagParams): Promise<TagDTO> {
  const { siteId, submissionId, userId, input } = params;
  await assertSubmissionOnSite(siteId, submissionId);

  const tag = await resolveTag(siteId, input);

  const prisma = await getPrismaClient();
  const existing = await prisma.tagsInSubmissions.findUnique({
    where: { submission_id_tag_id: { submission_id: submissionId, tag_id: tag.id } },
    select: { id: true },
  });

  if (!existing) {
    await prisma.tagsInSubmissions.create({
      data: {
        id: uuidv7(),
        date_created: new Date().toISOString(),
        tag: { connect: { id: tag.id } },
        submission: { connect: { id: submissionId } },
      },
      select: { id: true },
    });
    await recordTagActivity(submissionId, userId, tag, 'added');
  }

  return formatTagDTO(tag);
}

/** Remove one tag from a submission. The tag stays in the site catalog. */
export async function removeTagFromSubmission(params: RemoveTagParams): Promise<TagDTO> {
  const { siteId, submissionId, userId, tagId } = params;
  await assertSubmissionOnSite(siteId, submissionId);

  const tag = await resolveTag(siteId, { tagId });

  const prisma = await getPrismaClient();
  const deleted = await prisma.tagsInSubmissions.deleteMany({
    where: { submission_id: submissionId, tag_id: tagId },
  });

  if (deleted.count > 0) {
    await recordTagActivity(submissionId, userId, tag, 'removed');
  }

  return formatTagDTO(tag);
}
```

- [ ] **Step 4: Export it**

In `packages/scms-server/src/backend/loaders/sites/tags/index.ts`:

```ts
export * from './assign.server.js';
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bun run build:scms
bun --cwd platform/scms run test:integration 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/scms-server/src/backend/loaders/sites/tags platform/scms/tests/integration/workflow/submission-tags.spec.ts
git commit -m "✨ Assign and remove submission tags"
```

---

### Task 5: Tag catalog on the site endpoint

**Files:**
- Modify: `packages/common/src/types/index.ts` (`SiteDTO`, around line 71)
- Modify: `packages/scms-server/src/backend/loaders/sites/get.server.ts:19-30` (`dbGetSite`) and `:86-116` (`formatSiteDTO`)
- Modify: `packages/scms-server/src/backend/loaders/sites/list.server.ts:7-12` (`dbListMany` default include)
- Test: `packages/scms-server/src/backend/loaders/sites/get.server.test.ts`

**Interfaces:**
- Consumes: `formatTagDTO`, `TagDTO`
- Produces: `SiteDTO.tags: TagDTO[]` on `GET /v1/sites/:siteName` and `GET /v1/sites`

- [ ] **Step 1: Write the failing test**

Append to `packages/scms-server/src/backend/loaders/sites/get.server.test.ts`:

```ts
describe('formatSiteDTO tags', () => {
  const baseDbo = {
    id: 'site1',
    name: 'science',
    title: 'Science',
    metadata: {},
    collections: [],
    domains: [],
  };

  test('maps the tag catalog', () => {
    const ctx = createMockContext();
    const dto = formatSiteDTO(ctx, {
      ...baseDbo,
      tags: [
        { id: 'tag2', name: 'blog-post', label: 'Blog Post' },
        { id: 'tag1', name: 'editors-pick', label: 'Editors Pick' },
      ],
    } as never);

    expect(dto.tags).toEqual([
      { id: 'tag2', name: 'blog-post', label: 'Blog Post' },
      { id: 'tag1', name: 'editors-pick', label: 'Editors Pick' },
    ]);
  });

  test('returns an empty catalog when the caller include omits tags', () => {
    const ctx = createMockContext();
    const dto = formatSiteDTO(ctx, baseDbo as never);
    expect(dto.tags).toEqual([]);
  });
});
```

The file already imports `formatSiteDTO` and defines `createMockContext`, and
already mocks `../../domains.server` and `../../format.server`. Reuse them —
add no new mocks. Copy the `metadata`, `private`, `restricted`, `external`,
`description` and `default_workflow` fields from the neighbouring test's site
object into `baseDbo` so the formatter has what it reads.

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd packages/scms-server run test src/backend/loaders/sites/get.server.test.ts
```

Expected: FAIL — `dto.tags` is undefined.

- [ ] **Step 3: Add the field to the DTO**

In `packages/common/src/types/index.ts`, in `SiteDTO`:

```ts
export type SiteDTO = SiteConfig & {
  id: string;
  url?: string;
  /** Editorial tag catalog for the site. Not the version tags on works. */
  tags: TagDTO[];
  links: {
```

- [ ] **Step 4: Select and map the tags**

In `packages/scms-server/src/backend/loaders/sites/get.server.ts`, inside `dbGetSite`'s `include`:

```ts
      tags: {
        select: { id: true, name: true, label: true },
        orderBy: { label: 'asc' },
      },
```

Import the formatter at the top:

```ts
import { formatTagDTO } from './tags/format.server.js';
```

In `formatSiteDTO`, beside `collections`:

```ts
    tags: (dbo.tags ?? []).map((t) => formatTagDTO(t)),
```

`dbListMany` accepts a caller `include`, so the `?? []` guard keeps the formatter total.

- [ ] **Step 5: Add the same include to the listing query**

In `packages/scms-server/src/backend/loaders/sites/list.server.ts`, in the default `inc`:

```ts
    tags: { orderBy: { label: 'asc' } },
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
bun --cwd packages/scms-server run test src/backend/loaders/sites/get.server.test.ts
bun --cwd packages/scms-server run compile
```

Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/common/src/types/index.ts packages/scms-server/src/backend/loaders/sites/get.server.ts packages/scms-server/src/backend/loaders/sites/list.server.ts packages/scms-server/src/backend/loaders/sites/get.server.test.ts
git commit -m "✨ Return the site tag catalog on the site endpoint"
```

---

### Task 6: submission_tags on the published payload

**Files:**
- Create: `packages/scms-server/src/backend/loaders/sites/submissions/published/select.server.ts`
- Modify: `packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.ts:180-190` (default export)
- Modify: `packages/scms-server/src/backend/loaders/sites/submissions/published/resolve.server.ts:86-90`
- Test: `packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.test.ts`

**Interfaces:**
- Consumes: `formatTagDTO`, `siteWorkDtoSelect`, `siteWorkSubmissionSelect`
- Produces:
  - `publishedSiteWorkWithTagsSelect`
  - `dbGetPublishedSiteWorkWithTagsDto(siteId: string, workIdOrSlug: string)`
  - `PublishedSiteWorkWithTagsDTO = PublishedSiteWorkDTO & { submission_tags: TagDTO[] }`
  - the `/published` route returns `submission_tags`

`formatPublishedSiteWorkWithVersions` must not change: the DOI endpoints call it.

- [ ] **Step 1: Write the failing test**

Append to `packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.test.ts`:

```ts
describe('formatPublishedSubmissionTags', () => {
  test('maps the join rows to TagDTOs', () => {
    const tags = formatPublishedSubmissionTags({
      submission: {
        tags: [
          { tag: { id: 'tag1', name: 'blog-post', label: 'Blog Post' } },
          { tag: { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' } },
        ],
      },
    } as never);

    expect(tags).toEqual([
      { id: 'tag1', name: 'blog-post', label: 'Blog Post' },
      { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' },
    ]);
  });

  test('version tags are untouched by the editorial tags', () => {
    const ctx = createMockSiteContext();
    const dbo = {
      id: 'version1',
      tags: ['v2'],
      work_version: {
        id: 'wv1',
        work_id: 'work1',
        title: 'A title',
        authors: [],
        tags: ['preprint'],
        date_created: '2026-08-27T00:00:00.000Z',
      },
      submission: {
        id: 'sub1',
        slugs: [],
        kind: { id: 'kind1', name: 'Article' },
        collection: { id: 'collection1', name: 'Articles' },
        tags: [{ tag: { id: 'tag1', name: 'blog-post', label: 'Blog Post' } }],
      },
    };

    const siteWork = formatSiteWorkDTO(ctx, dbo as never);
    expect(siteWork.tags).toEqual(['v2', 'preprint']);
    expect((siteWork as Record<string, unknown>).submission_tags).toBeUndefined();
  });
});
```

Import `formatPublishedSubmissionTags` from `./get.server.js` at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd packages/scms-server run test src/backend/loaders/sites/submissions/published/get.server.test.ts
```

Expected: FAIL — `formatPublishedSubmissionTags` is not exported.

- [ ] **Step 3: Add the published-only select**

Create `packages/scms-server/src/backend/loaders/sites/submissions/published/select.server.ts`:

```ts
import type { Prisma } from '@curvenote/scms-db';
import {
  siteWorkDtoSelect,
  siteWorkSubmissionSelect,
} from '../../../../prisma.selects.server.js';

/**
 * `siteWorkDtoSelect` plus the editorial tags of the submission.
 *
 * Only `GET /v1/sites/:siteName/works/:workIdOrSlug/published` uses this. The
 * shared selects stay narrow so the DOI and listing endpoints keep their
 * current payload and query cost.
 */
export const publishedSiteWorkWithTagsSelect = {
  ...siteWorkDtoSelect,
  submission: {
    select: {
      ...siteWorkSubmissionSelect,
      tags: {
        select: { tag: { select: { id: true, name: true, label: true } } },
        orderBy: { tag: { label: 'asc' } },
      },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;

export type PublishedSiteWorkWithTagsRow = Prisma.SubmissionVersionGetPayload<{
  select: typeof publishedSiteWorkWithTagsSelect;
}>;
```

- [ ] **Step 4: Add the resolve helper**

In `packages/scms-server/src/backend/loaders/sites/submissions/published/resolve.server.ts`, after `dbGetPublishedSiteWorkDto`:

```ts
export async function dbGetPublishedSiteWorkWithTagsDto(siteId: string, workIdOrSlug: string) {
  const id = await fetchPublishedSubmissionVersionId(siteId, workIdOrSlug);
  if (!id) return null;
  return hydratePublishedSubmissionVersion(id, publishedSiteWorkWithTagsSelect);
}
```

Import the select at the top:

```ts
import { publishedSiteWorkWithTagsSelect } from './select.server.js';
```

- [ ] **Step 5: Map the field on the published endpoint only**

In `packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.ts`, add the formatter and swap the default export:

```ts
export type PublishedSiteWorkWithTagsDTO = PublishedSiteWorkDTO & {
  submission_tags: TagDTO[];
};

/** Editorial tags of the submission behind a published site work. */
export function formatPublishedSubmissionTags(row: PublishedSiteWorkWithTagsRow): TagDTO[] {
  return row.submission.tags.map((join) => formatTagDTO(join.tag));
}

export default async function (
  ctx: SiteContext,
  workIdOrSlug: string,
): Promise<PublishedSiteWorkWithTagsDTO | null> {
  const dbo = await dbGetPublishedSiteWorkWithTagsDto(ctx.site.id, workIdOrSlug);
  if (!dbo) return null;
  const siteWork = await formatPublishedSiteWorkWithVersions(ctx, dbo);
  return { ...siteWork, submission_tags: formatPublishedSubmissionTags(dbo) };
}
```

Add the imports at the top of the file:

```ts
import type { TagDTO } from '@curvenote/common';
import { formatTagDTO } from '../../tags/format.server.js';
import { dbGetPublishedSiteWorkWithTagsDto } from './resolve.server.js';
import type { PublishedSiteWorkWithTagsRow } from './select.server.js';
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
bun --cwd packages/scms-server run test src/backend/loaders/sites/submissions/published/get.server.test.ts
bun --cwd packages/scms-server run compile
```

Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/scms-server/src/backend/loaders/sites/submissions/published
git commit -m "✨ Return submission tags on the published work payload"
```

---

### Task 7: Tags on the submission details loader

**Files:**
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/types.ts:63-78` (`SubmissionDetailSubmission`)
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/db.server.ts:93-155` (`dbLoadSubmissionDetail`)
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/detail.format.server.ts:120-162`
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/loader.server.ts`
- Create: `ee/sites/src/routes/$siteName.submissions.$submissionId/detail.format.tags.spec.ts`

**Interfaces:**
- Consumes: `TagDTO`
- Produces: `SubmissionDetailPageData.siteTags: TagDTO[]` (the catalog) and `SubmissionDetailSubmission.tags: TagDTO[]` (assigned)

- [ ] **Step 1: Write the failing test**

Create `ee/sites/src/routes/$siteName.submissions.$submissionId/detail.format.tags.spec.ts`:

```ts
/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatSubmissionDetailTags } from './detail.format.server.js';

describe('formatSubmissionDetailTags', () => {
  test('maps the join rows to TagDTOs', () => {
    expect(
      formatSubmissionDetailTags([
        { tag: { id: 'tag1', name: 'blog-post', label: 'Blog Post' } },
        { tag: { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' } },
      ]),
    ).toEqual([
      { id: 'tag1', name: 'blog-post', label: 'Blog Post' },
      { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' },
    ]);
  });

  test('handles a submission with no tags', () => {
    expect(formatSubmissionDetailTags([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd ee/sites run test src/routes/'$siteName.submissions.$submissionId'/detail.format.tags.spec.ts
```

Expected: FAIL — `formatSubmissionDetailTags` is not exported.

- [ ] **Step 3: Select the tags**

In `db.server.ts`, add to the `prisma.submission.findFirst` select, beside `slugs`:

```ts
        tags: {
          select: { tag: { select: { id: true, name: true, label: true } } },
          orderBy: { tag: { label: 'asc' } },
        },
```

Add to `SubmissionDetailRow`, beside `slugs`:

```ts
  tags: { tag: { id: string; name: string; label: string } }[];
```

Add a catalog loader at the end of the file:

```ts
/** Every tag defined on the site, for the tag picker. */
export async function dbListSiteTagRows(siteId: string) {
  const prisma = await getPrismaClient();
  return prisma.tag.findMany({
    where: { site_id: siteId },
    select: { id: true, name: true, label: true },
    orderBy: { label: 'asc' },
  });
}
```

- [ ] **Step 4: Map the tags**

In `detail.format.server.ts`, add the exported formatter above `formatSubmissionDetailSubmission`:

```ts
/** Editorial tags assigned to the submission, ready for the loader payload. */
export function formatSubmissionDetailTags(rows: SubmissionDetailRow['tags']): TagDTO[] {
  return rows.map((row) => ({ id: row.tag.id, name: row.tag.name, label: row.tag.label }));
}
```

Import the type at the top:

```ts
import type { TagDTO } from '@curvenote/common';
```

Inside `formatSubmissionDetailSubmission`, add to the `submission` object beside `slug`:

```ts
    tags: formatSubmissionDetailTags(row.tags),
```

In `types.ts`, add to `SubmissionDetailSubmission` beside `slug`:

```ts
  /** Editorial tags. Not the version tags on SubmissionDetailVersion.tags. */
  tags: TagDTO[];
```

Import `TagDTO` from `@curvenote/common` at the top of `types.ts`.

- [ ] **Step 5: Load the catalog**

In `loader.server.ts`, add `siteTags: TagDTO[]` to `SubmissionDetailPageData`, import `TagDTO` and `dbListSiteTagRows`, add the call to the existing `Promise.all`:

```ts
      dbListSiteTagRows(ctx.site.id),
```

Destructure it as `siteTags` and return it in the payload object.

- [ ] **Step 6: Run the test and the type check**

```bash
bun --cwd ee/sites run test src/routes/'$siteName.submissions.$submissionId'/detail.format.tags.spec.ts
bun --cwd ee/sites run compile
```

Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add "ee/sites/src/routes/\$siteName.submissions.\$submissionId"
git commit -m "✨ Load submission tags and the site catalog on the details page"
```

---

### Task 8: Tag picker UI and route action

**Files:**
- Create: `ee/sites/src/routes/$siteName.submissions.$submissionId/TagPicker.utils.ts`
- Create: `ee/sites/src/routes/$siteName.submissions.$submissionId/TagPicker.utils.spec.ts`
- Create: `ee/sites/src/routes/$siteName.submissions.$submissionId/TagPicker.tsx`
- Create: `ee/sites/src/routes/$siteName.submissions.$submissionId/SubmissionTags.tsx`
- Create: `ee/sites/src/routes/$siteName.submissions.$submissionId/tags.server.ts`
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/route.tsx:88-112` (action dispatch)
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/SubmissionDetails.tsx:180-195` (detail rows)

**Interfaces:**
- Consumes: `TagDTO`, `toTagName`, `isValidTagName`, `sites.tags.assignTagToSubmission`, `sites.tags.removeTagFromSubmission`, `SubmissionDetailPageData.siteTags`
- Produces:
  - `filterTagOptions(catalog: TagDTO[], query: string): TagDTO[]`
  - `getCreateTagOption(catalog: TagDTO[], query: string): { label: string; name: string } | undefined`
  - form actions `tag-assign` and `tag-remove`

- [ ] **Step 1: Write the failing test**

Create `TagPicker.utils.spec.ts`:

```ts
/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

const catalog = [
  { id: 'tag1', name: 'blog-post', label: 'Blog Post' },
  { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' },
];

describe('filterTagOptions', () => {
  test('returns the whole catalog for an empty query', () => {
    expect(filterTagOptions(catalog, '')).toEqual(catalog);
  });

  test('matches on label, case insensitively', () => {
    expect(filterTagOptions(catalog, 'blog')).toEqual([catalog[0]]);
  });

  test('matches on name', () => {
    expect(filterTagOptions(catalog, 'editors-pick')).toEqual([catalog[1]]);
  });
});

describe('getCreateTagOption', () => {
  test('offers a create option for a new label', () => {
    expect(getCreateTagOption(catalog, 'Case Study')).toEqual({
      label: 'Case Study',
      name: 'case-study',
    });
  });

  test('offers nothing when the derived name already exists', () => {
    expect(getCreateTagOption(catalog, 'blog post')).toBeUndefined();
  });

  test('offers nothing for a name that is too short', () => {
    expect(getCreateTagOption(catalog, 'ab')).toBeUndefined();
  });

  test('offers nothing for an empty query', () => {
    expect(getCreateTagOption(catalog, '   ')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd ee/sites run test src/routes/'$siteName.submissions.$submissionId'/TagPicker.utils.spec.ts
```

Expected: FAIL — cannot resolve `./TagPicker.utils.js`.

- [ ] **Step 3: Write the picker utils**

Create `TagPicker.utils.ts`:

```ts
import type { TagDTO } from '@curvenote/common';
import { isValidTagName, toTagName } from '@curvenote/scms-core';

/** Catalog entries matching the typed query on label or name. */
export function filterTagOptions(catalog: TagDTO[], query: string): TagDTO[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return catalog;
  return catalog.filter(
    (tag) => tag.label.toLowerCase().includes(needle) || tag.name.includes(needle),
  );
}

/**
 * The `Create "…"` row, or nothing when the typed text is empty, derives an
 * invalid name, or matches a tag that already exists.
 */
export function getCreateTagOption(
  catalog: TagDTO[],
  query: string,
): { label: string; name: string } | undefined {
  const label = query.trim();
  if (!label) return undefined;
  const name = toTagName(label);
  if (!isValidTagName(name)) return undefined;
  if (catalog.some((tag) => tag.name === name)) return undefined;
  return { label, name };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun --cwd ee/sites run test src/routes/'$siteName.submissions.$submissionId'/TagPicker.utils.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write the server action helpers**

Create `tags.server.ts`:

```ts
import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { formatZodError, TrackEvent } from '@curvenote/scms-core';
import { sites, type SiteContextWithUser } from '@curvenote/scms-server';

const assignSchema = zfd.formData({
  submission_id: zfd.text(z.uuid()),
  tag_id: zfd.text(z.uuid()).optional(),
  label: zfd.text(z.string().min(1)).optional(),
});

const removeSchema = zfd.formData({
  submission_id: zfd.text(z.uuid()),
  tag_id: zfd.text(z.uuid()),
});

export async function actionAssignTag(ctx: SiteContextWithUser, formData: FormData) {
  let payload;
  try {
    payload = assignSchema.parse(formData);
  } catch (e: any) {
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, tag_id, label } = payload;
  if (!tag_id && !label) {
    return data({ error: 'tag_id or label is required' }, { status: 400 });
  }

  try {
    const tag = await sites.tags.assignTagToSubmission({
      siteId: ctx.site.id,
      submissionId: submission_id,
      userId: ctx.user.id,
      input: tag_id ? { tagId: tag_id } : { label: label as string },
    });

    await ctx.trackEvent(TrackEvent.SUBMISSION_TAGS_CHANGED, {
      submissionId: submission_id,
      tagId: tag.id,
      tagName: tag.name,
      action: 'added',
    });
    await ctx.analytics.flush();

    return { tag };
  } catch (e: any) {
    return data({ error: e.message ?? 'could not assign tag' }, { status: e.status ?? 500 });
  }
}

export async function actionRemoveTag(ctx: SiteContextWithUser, formData: FormData) {
  let payload;
  try {
    payload = removeSchema.parse(formData);
  } catch (e: any) {
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, tag_id } = payload;

  try {
    const tag = await sites.tags.removeTagFromSubmission({
      siteId: ctx.site.id,
      submissionId: submission_id,
      userId: ctx.user.id,
      tagId: tag_id,
    });

    await ctx.trackEvent(TrackEvent.SUBMISSION_TAGS_CHANGED, {
      submissionId: submission_id,
      tagId: tag.id,
      tagName: tag.name,
      action: 'removed',
    });
    await ctx.analytics.flush();

    return { tag };
  } catch (e: any) {
    return data({ error: e.message ?? 'could not remove tag' }, { status: e.status ?? 500 });
  }
}
```

- [ ] **Step 6: Dispatch the new form actions**

In `route.tsx`, import the helpers and add two branches to the `formAction` chain, after `set-date-published`:

```ts
  } else if (formAction === 'tag-assign') {
    return actionAssignTag(ctx, formData);
  } else if (formAction === 'tag-remove') {
    return actionRemoveTag(ctx, formData);
```

The existing scope guard on the `action` already blocks users without `scopes.site.submissions.update`.

- [ ] **Step 7: Write the picker component**

Create `TagPicker.tsx`:

```tsx
import { useState } from 'react';
import type { TagDTO } from '@curvenote/common';
import { ui, primitives } from '@curvenote/scms-core';
import { Check, Plus } from 'lucide-react';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

type TagPickerProps = {
  catalog: TagDTO[];
  assignedIds: string[];
  disabled?: boolean;
  onToggle: (tag: TagDTO) => void;
  onCreate: (label: string) => void;
  children: React.ReactNode;
};

export function TagPicker({
  catalog,
  assignedIds,
  disabled,
  onToggle,
  onCreate,
  children,
}: TagPickerProps) {
  const [query, setQuery] = useState('');
  const options = filterTagOptions(catalog, query);
  const createOption = getCreateTagOption(catalog, query);

  return (
    <primitives.PopoverWrapper
      skip={disabled}
      contentAlign="start"
      className="w-72 p-0"
      content={
        <ui.Command shouldFilter={false}>
          <ui.CommandInput placeholder="Search or create a tag…" onValueChange={setQuery} />
          <ui.CommandList>
            {options.length === 0 && !createOption ? (
              <ui.CommandEmpty>No tags found.</ui.CommandEmpty>
            ) : null}
            <ui.CommandGroup>
              {options.map((tag) => (
                <ui.CommandItem key={tag.id} value={tag.id} onSelect={() => onToggle(tag)}>
                  <Check
                    className={
                      assignedIds.includes(tag.id)
                        ? 'mr-2 h-4 w-4 opacity-100'
                        : 'mr-2 h-4 w-4 opacity-0'
                    }
                    aria-hidden
                  />
                  {tag.label}
                </ui.CommandItem>
              ))}
              {createOption ? (
                <ui.CommandItem
                  value={`create-${createOption.name}`}
                  onSelect={() => onCreate(createOption.label)}
                >
                  <Plus className="mr-2 w-4 h-4" aria-hidden />
                  {`Create "${createOption.label}"`}
                </ui.CommandItem>
              ) : null}
            </ui.CommandGroup>
          </ui.CommandList>
        </ui.Command>
      }
    >
      {children}
    </primitives.PopoverWrapper>
  );
}
```

- [ ] **Step 8: Write the detail row component**

Create `SubmissionTags.tsx`:

```tsx
import { useFetcher, useLoaderData } from 'react-router';
import type { TagDTO } from '@curvenote/common';
import { ui } from '@curvenote/scms-core';
import type { SubmissionDetailPageData } from './loader.server.js';
import { TagPicker } from './TagPicker.js';
import { emptyDetailValue } from './SubmissionDetails.utils.js';

type SubmissionTagsProps = {
  submissionId: string;
  tags: TagDTO[];
  canUpdate: boolean;
};

export function SubmissionTags({ submissionId, tags, canUpdate }: SubmissionTagsProps) {
  const { siteTags } = useLoaderData<SubmissionDetailPageData>();
  const fetcher = useFetcher<{ error?: string; tag?: TagDTO }>();
  const assignedIds = tags.map((tag) => tag.id);

  const toggle = (tag: TagDTO) => {
    fetcher.submit(
      {
        submission_id: submissionId,
        tag_id: tag.id,
        formAction: assignedIds.includes(tag.id) ? 'tag-remove' : 'tag-assign',
      },
      { method: 'POST' },
    );
  };

  const create = (label: string) => {
    fetcher.submit(
      { submission_id: submissionId, label, formAction: 'tag-assign' },
      { method: 'POST' },
    );
  };

  const chips = tags.length ? (
    tags.map((tag) => (
      <ui.Badge key={tag.id} variant="outline-muted" size="xs" title={tag.name}>
        {tag.label}
      </ui.Badge>
    ))
  ) : (
    <span className="text-sm text-muted-foreground">{emptyDetailValue()}</span>
  );

  if (!canUpdate) {
    return <div className="flex flex-wrap gap-1 items-center">{chips}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center w-full min-w-0">
      <TagPicker
        catalog={siteTags}
        assignedIds={assignedIds}
        onToggle={toggle}
        onCreate={create}
      >
        <button
          type="button"
          className="flex flex-wrap gap-1 items-center text-left"
          title="Add or remove tags"
          aria-label="Add or remove tags"
          disabled={fetcher.state !== 'idle'}
        >
          {chips}
        </button>
      </TagPicker>
      {fetcher.data?.error ? (
        <span className="text-sm text-destructive">{fetcher.data.error}</span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 9: Add the detail row**

In `SubmissionDetails.tsx`, import `SubmissionTags` and add a row between "Submission Kind" and "Slug":

```tsx
        <DetailRow label="Tags">
          <SubmissionTags
            submissionId={submission.id}
            tags={submission.tags}
            canUpdate={canUpdate}
          />
        </DetailRow>
```

- [ ] **Step 10: Check types and lint**

```bash
bun --cwd ee/sites run compile
bun --cwd ee/sites run lint
```

Expected: no errors. If `ui.Badge` rejects `size="xs"`, check `packages/scms-core/src/components/ui/badge.tsx` for the accepted variants and use the ones the listing chips already use.

- [ ] **Step 11: Commit**

```bash
git add "ee/sites/src/routes/\$siteName.submissions.\$submissionId"
git commit -m "✨ Add and remove submission tags from one popover"
```

---

### Task 9: Tags on the submissions listing

**Files:**
- Modify: `ee/sites/src/routes/$siteName.submissions._index/db.server.ts:79-140` (`IndexListingRow`, `INDEX_LISTING_SELECT`)
- Modify: `ee/sites/src/routes/$siteName.submissions._index/types.ts:74-90` (`SubmissionsIndexItem`)
- Modify: `ee/sites/src/routes/$siteName.submissions._index/format.server.ts:17-58`
- Modify: `ee/sites/src/components/Chips.tsx` (append)
- Modify: `ee/sites/src/routes/$siteName.submissions._index/SubmissionsListItem.tsx:62-92`
- Create: `ee/sites/src/routes/$siteName.submissions._index/format.tags.spec.ts`

**Interfaces:**
- Consumes: `TagDTO`
- Produces: `SubmissionsIndexItem.tags: TagDTO[]`, `<Tag label={…} name={…} />` chip

- [ ] **Step 1: Write the failing test**

Create `ee/sites/src/routes/$siteName.submissions._index/format.tags.spec.ts`:

```ts
/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatIndexItemTags } from './format.server.js';

describe('formatIndexItemTags', () => {
  test('maps the join rows to TagDTOs', () => {
    expect(
      formatIndexItemTags([{ tag: { id: 'tag1', name: 'blog-post', label: 'Blog Post' } }]),
    ).toEqual([{ id: 'tag1', name: 'blog-post', label: 'Blog Post' }]);
  });

  test('handles a row with no tags', () => {
    expect(formatIndexItemTags([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd ee/sites run test src/routes/'$siteName.submissions._index'/format.tags.spec.ts
```

Expected: FAIL — `formatIndexItemTags` is not exported.

- [ ] **Step 3: Select the tags**

In `db.server.ts`, add to `INDEX_LISTING_SELECT`, after `collection`:

```ts
  /**
   * Editorial tags of the submission. Not to be confused with
   * `versions[].tags`, which are the version tags feeding `versionTag`.
   */
  tags: {
    select: { tag: { select: { id: true, name: true, label: true } } },
    orderBy: { tag: { label: 'asc' } },
  },
```

Add a matching comment on the `versions.select.tags` line:

```ts
      /** Version tags (`v1`, `preprint`), read by `pickVersionTag`. */
      tags: true,
```

Add to `IndexListingRow`, after `collection`:

```ts
  tags: { tag: { id: string; name: string; label: string } }[];
```

- [ ] **Step 4: Map the tags**

In `format.server.ts`, add the exported helper above `formatSubmissionsIndexItems`:

```ts
/** Editorial tags on a listing row. */
export function formatIndexItemTags(rows: IndexListingRow['tags']): TagDTO[] {
  return rows.map((row) => ({ id: row.tag.id, name: row.tag.name, label: row.tag.label }));
}
```

Import `TagDTO` from `@curvenote/common`, and add to the returned item object:

```ts
      tags: formatIndexItemTags(row.tags),
```

In `types.ts`, add to `SubmissionsIndexItem`:

```ts
  /** Editorial tags. Not the version tags behind `versionTag`. */
  tags: TagDTO[];
```

Import `TagDTO` from `@curvenote/common` at the top of `types.ts`.

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun --cwd ee/sites run test src/routes/'$siteName.submissions._index'/format.tags.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Add the chip**

Append to `ee/sites/src/components/Chips.tsx`:

```tsx
export function Tag({ label, name }: { label: string; name: string }) {
  return (
    <primitives.Chip
      className="text-violet-700 border-[1px] border-violet-700 dark:border-violet-300 dark:text-violet-300"
      title={`Tag - ${name}`}
    >
      {label}
    </primitives.Chip>
  );
}
```

- [ ] **Step 7: Render up to three chips**

In `SubmissionsListItem.tsx`, import `Tag` from `../../components/Chips.js` and add inside the chip row, after the kind chip:

```tsx
            {item.tags.slice(0, 3).map((tag) => (
              <Tag key={tag.id} label={tag.label} name={tag.name} />
            ))}
            {item.tags.length > 3 ? (
              <primitives.Chip
                className="text-violet-700 border-[1px] border-violet-700 dark:border-violet-300 dark:text-violet-300"
                title={item.tags
                  .slice(3)
                  .map((tag) => tag.label)
                  .join(', ')}
              >
                {`+${item.tags.length - 3}`}
              </primitives.Chip>
            ) : null}
```

Import `primitives` from `@curvenote/scms-core` in that file if it is not imported yet.

- [ ] **Step 8: Check types and lint**

```bash
bun --cwd ee/sites run compile
bun --cwd ee/sites run lint
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add "ee/sites/src/routes/\$siteName.submissions._index" ee/sites/src/components/Chips.tsx
git commit -m "✨ Show submission tags on the submissions listing"
```

---

### Task 10: Activity label and analytics event

**Files:**
- Modify: `packages/scms-core/src/utils/activityLabels.ts:5-12`
- Modify: `packages/scms-core/src/backend/services/analytics/events.ts:57-62` and `:155-160`
- Modify: `ee/sites/src/routes/$siteName.submissions.$submissionId/SubmissionVersionTimeline.tsx:110-125`
- Create: `packages/scms-core/src/utils/activityLabels.spec.ts`

**Interfaces:**
- Consumes: `ActivityType.SUBMISSION_TAGS_CHANGE`
- Produces: `ACTIVITY_TYPE_LABELS.SUBMISSION_TAGS_CHANGE`, `TrackEvent.SUBMISSION_TAGS_CHANGED` (used by Task 8)

If Task 8 runs first, `TrackEvent.SUBMISSION_TAGS_CHANGED` will not exist yet and `bun --cwd ee/sites run compile` fails. Do this task before Task 8, or add the enum value as the first step of Task 8.

- [ ] **Step 1: Write the failing test**

Create `packages/scms-core/src/utils/activityLabels.spec.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { ACTIVITY_TYPE_LABELS } from './activityLabels.js';

describe('ACTIVITY_TYPE_LABELS', () => {
  test('labels the submission tags change', () => {
    expect(ACTIVITY_TYPE_LABELS.SUBMISSION_TAGS_CHANGE).toBe('Submission tags changed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun --cwd packages/scms-core run test src/utils/activityLabels.spec.ts
```

Expected: FAIL — the value is undefined.

- [ ] **Step 3: Add the label**

In `packages/scms-core/src/utils/activityLabels.ts`, after `SUBMISSION_DATE_CHANGE`:

```ts
  SUBMISSION_TAGS_CHANGE: 'Submission tags changed',
```

- [ ] **Step 4: Add the analytics event**

In `packages/scms-core/src/backend/services/analytics/events.ts`, in the `TrackEvent` enum after `SUBMISSION_KIND_CHANGED`:

```ts
  SUBMISSION_TAGS_CHANGED = 'Submission Tags Changed',
```

And in the description map after `[TrackEvent.SUBMISSION_KIND_CHANGED]`:

```ts
  [TrackEvent.SUBMISSION_TAGS_CHANGED]: 'Submission editorial tags added or removed',
```

- [ ] **Step 5: Carry the tag through the activity payload**

`SubmissionDetailActivity` has no raw `data` field, so the formatter must lift
what the timeline needs.

In `ee/sites/.../$submissionId/types.ts`, add to `SubmissionDetailActivity`:

```ts
  tag_change?: { label: string; action: 'added' | 'removed' };
```

In `detail.format.server.ts`, inside `formatDetailActivity`, after the
`jobFailure` block:

```ts
  const tagDetail = data?.tag as { label?: string } | undefined;
  const tagChange =
    activity.activity_type === 'SUBMISSION_TAGS_CHANGE' && typeof tagDetail?.label === 'string'
      ? {
          label: tagDetail.label,
          action: data?.action === 'removed' ? ('removed' as const) : ('added' as const),
        }
      : undefined;
```

and add it to the returned object beside `job_failure`:

```ts
    tag_change: tagChange,
```

- [ ] **Step 6: Render the timeline entry**

In `SubmissionVersionTimeline.tsx`, directly after the `SUBMISSION_KIND_CHANGE`
branch (around line 115), add a branch with the same `ActivityDetailRows`
shape the neighbours use:

```tsx
  if (activity.activity_type === 'SUBMISSION_TAGS_CHANGE' && activity.tag_change) {
    return (
      <ActivityDetailRows
        rows={[[activity.tag_change.action === 'removed' ? 'Tag removed' : 'Tag added', activity.tag_change.label]]}
      />
    );
  }
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
bun --cwd packages/scms-core run test src/utils/activityLabels.spec.ts
bun --cwd packages/scms-core run compile
bun --cwd ee/sites run compile
```

Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/scms-core/src/utils/activityLabels.ts packages/scms-core/src/utils/activityLabels.spec.ts packages/scms-core/src/backend/services/analytics/events.ts "ee/sites/src/routes/\$siteName.submissions.\$submissionId/SubmissionVersionTimeline.tsx"
git commit -m "✨ Label submission tag changes in the timeline"
```

Also stage `types.ts` and `detail.format.server.ts` from the same route folder.

---

### Task 11: API end-to-end coverage

**Files:**
- Modify: `prisma/data.test/science.json`
- Modify: `prisma/seed.utils.mts:480-560` (site creation) and `:680-700` (submission creation)
- Modify: `platform/scms/tests/e2e/sites.public.spec.ts`
- Create: `platform/scms/tests/e2e/sites.tags.spec.ts`

**Interfaces:**
- Consumes: everything above
- Produces: e2e proof that the catalog and `submission_tags` are served

- [ ] **Step 1: Confirm the test seed runs today**

```bash
bun --cwd platform/scms run test:db:reset 2>&1 | tail -20
```

If the seed rejects the non-UUID work ids in `prisma/data.test/*.json`, stop and report it. That is a pre-existing seeding problem, not part of this work — Tasks 1 to 10 do not depend on it.

- [ ] **Step 2: Write the failing test**

Create `platform/scms/tests/e2e/sites.tags.spec.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { expectSuccess } from './helpers';

describe('sites.tags', () => {
  test('the site returns its tag catalog', async () => {
    const resp = await expectSuccess('sites/science');
    const site = (await resp.json()) as any;

    expect(site.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'blog-post', label: 'Blog Post' }),
      ]),
    );
  });

  test('the published work returns its editorial tags and keeps version tags', async () => {
    const resp = await expectSuccess('sites/science/works/CRV0001/published');
    const work = (await resp.json()) as any;

    expect(work.submission_tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'blog-post', label: 'Blog Post' }),
      ]),
    );
    expect(Array.isArray(work.tags)).toBe(true);
    work.tags.forEach((tag: unknown) => expect(typeof tag).toBe('string'));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
bun --cwd platform/scms run test:e2e 2>&1 | tail -30
```

Expected: FAIL — `site.tags` is `[]` and `submission_tags` is `[]`, because nothing is seeded yet.

- [ ] **Step 4: Add the fixture data**

In `prisma/data.test/science.json`, add to the `site` object:

```json
  "tags": [
    { "name": "blog-post", "label": "Blog Post" },
    { "name": "editors-pick", "label": "Editors Pick" }
  ],
```

And to the first work (`CRV0001`):

```json
  "submission_tags": ["blog-post"],
```

`submission_tags` is used in the fixture, not `tags`, so the file never confuses editorial tags with version tags.

- [ ] **Step 5: Seed the tags**

In `prisma/seed.utils.mts`, after the site and its collections are created (the block that ends with the `✓ Created site` log), create the catalog:

```ts
    const siteTags: { id: string; name: string }[] = [];
    for (const tag of item.site.tags ?? []) {
      const created = await prisma.tag.create({
        data: {
          id: uuid(),
          name: tag.name,
          label: tag.label,
          date_created: startDateString,
          site: { connect: { id: siteData.id } },
        },
        select: { id: true, name: true },
      });
      siteTags.push(created);
    }
```

In the `isFirstForWork` branch, beside the slug creation:

```ts
        for (const tagName of item.works[sv.workIndex]?.submission_tags ?? []) {
          const tag = siteTags.find((t) => t.name === tagName);
          if (!tag) throw new Error(`Seed work references unknown tag "${tagName}"`);
          await prisma.tagsInSubmissions.create({
            data: {
              id: uuid(),
              date_created: sv.date_created,
              tag: { connect: { id: tag.id } },
              submission: { connect: { id: subVersion.submission_id } },
            },
          });
        }
```

- [ ] **Step 6: Reseed and run the tests**

```bash
bun --cwd platform/scms run test:db:reset
bun --cwd platform/scms run test:e2e 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 7: Assert the DOI payload is unchanged**

In `platform/scms/tests/e2e/sites.doi.spec.ts`, inside the existing describe block:

```ts
  test('the DOI payload carries no editorial tags', async () => {
    const resp = await expectSuccess('sites/science/doi/10.5281/zenodo.5634114');
    const work = (await resp.json()) as any;
    expect(work.submission_tags).toBeUndefined();
  });
```

That is the DOI the passing test at line 17 of the same file already resolves.

- [ ] **Step 8: Run the e2e suite**

```bash
bun --cwd platform/scms run test:e2e 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add prisma/data.test/science.json prisma/seed.utils.mts platform/scms/tests/e2e
git commit -m "🧪 Cover the tag catalog and published tags end to end"
```

---

### Task 12: Close out

**Files:**
- Create: `.changeset/submission-tags-phase-1.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/submission-tags-phase-1.md`:

```markdown
---
'@curvenote/scms-sites-ext': minor
'@curvenote/scms-server': minor
'@curvenote/scms-core': minor
'@curvenote/common': minor
---

Add editorial tags on submissions: a site-scoped catalog, add and remove from
the site-admin submission details page, display on the submissions listing, the
catalog on `GET /v1/sites/:siteName`, and `submission_tags` on the published
work payload.
```

Check the package names against each `package.json` before committing.

- [ ] **Step 2: Run every check**

```bash
bun run lint
bun --cwd platform/scms run check-types
bun run test
bun --cwd platform/scms run test:unit
bun --cwd platform/scms run test:integration
```

Expected: all pass. Report any failure with its output; do not claim success without it.

- [ ] **Step 3: Check the UI by hand**

```bash
bun run dev
```

Open `/app/sites/<site>/submissions/<submissionId>`. Confirm: the Tags row appears; the popover opens from the empty state and from a chip; typing filters; `Create "…"` appears for new text and creates the tag; clicking an assigned tag removes it; the listing at `/app/sites/<site>/submissions` shows the chips.

- [ ] **Step 4: Commit**

```bash
git add .changeset/submission-tags-phase-1.md
git commit -m "📝 Add changeset for submission tags phase 1"
```

---

## Notes for the executor

- Task 10 must run before Task 8 compiles, because Task 8 uses `TrackEvent.SUBMISSION_TAGS_CHANGED`.
- Tasks 1 and 4 need the database up: `bun run dx:up`.
- After changing anything under `packages/`, run `bun run build:scms` before the `ee/sites` or `platform/scms` suites, which import the built packages.
- The branch is named `…submission-labels…` from before the issue was renamed. Keep the code on "tags"; do not rename files to "labels".
