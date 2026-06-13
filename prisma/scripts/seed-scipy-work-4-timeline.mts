/**
 * One-off dev seed: 20 work versions + 12 submission versions for timeline popover testing.
 *
 *   npx tsx prisma/scripts/seed-scipy-work-4-timeline.mts
 */
import { getLowLevelPrismaClient } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';

const WORK_ID = '019b8eee-306f-7cd6-80e4-720da4aa1559';
const EXISTING_WORK_VERSION_ID = '019b8eee-306f-7cd6-80e4-720e3f5810d8';
const SUBMISSION_ID = '019eb721-25f3-7042-8964-751893c88bec';
const EXISTING_SUBMISSION_VERSION_ID = '019eb721-25f3-7042-8964-75176dadc63c';
const SUBMITTED_BY_ID = 'mVkwApbQbKQ0ClO9A8ixYOP74JV2';

const TOTAL_WORK_VERSIONS = 20;
const TOTAL_SUBMISSION_VERSIONS = 12;

/** Work version indices (0 = oldest) that receive a submission version. */
const SUBMISSION_WORK_VERSION_INDICES = [0, 2, 4, 6, 8, 10, 12, 14, 16, 17, 18, 19];

const SUBMISSION_STATUSES: Array<{
  status: string;
  published: boolean;
}> = [
  { status: 'PUBLISHED', published: true },
  { status: 'PENDING', published: false },
  { status: 'REJECTED', published: false },
  { status: 'PUBLISHED', published: true },
  { status: 'PENDING', published: false },
  { status: 'UNPUBLISHED', published: false },
  { status: 'PUBLISHED', published: true },
  { status: 'PENDING', published: false },
  { status: 'RETRACTED', published: true },
  { status: 'PUBLISHED', published: true },
  { status: 'PENDING', published: false },
  { status: 'PUBLISHED', published: true },
];

function monthOffset(base: Date, monthsAgo: number): string {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d.toISOString();
}

const prisma = await getLowLevelPrismaClient();

const template = await prisma.workVersion.findUniqueOrThrow({
  where: { id: EXISTING_WORK_VERSION_ID },
});

const latestDate = new Date(template.date_created);
const oldestMonthsAgo = TOTAL_WORK_VERSIONS - 1;

const workVersionIds: string[] = new Array(TOTAL_WORK_VERSIONS);

for (let index = 0; index < TOTAL_WORK_VERSIONS; index += 1) {
  const monthsAgo = oldestMonthsAgo - index;
  const dateCreated = monthOffset(latestDate, monthsAgo);
  const isLatest = index === TOTAL_WORK_VERSIONS - 1;
  const id = isLatest ? EXISTING_WORK_VERSION_ID : uuid();

  workVersionIds[index] = id;

  if (isLatest) {
    await prisma.workVersion.update({
      where: { id },
      data: {
        date_created: dateCreated,
        date_modified: dateCreated,
        canonical: true,
        draft: false,
        tags: ['v20'],
      },
    });
    continue;
  }

  await prisma.workVersion.create({
    data: {
      id,
      work_id: WORK_ID,
      date_created: dateCreated,
      date_modified: dateCreated,
      draft: index >= TOTAL_WORK_VERSIONS - 2,
      title: template.title,
      description: template.description,
      authors: template.authors,
      author_details: template.author_details,
      date: isLatest ? template.date : null,
      cdn: template.cdn,
      cdn_key: template.cdn_key,
      canonical: false,
      tags: [`v${index + 1}`],
    },
  });
}

await prisma.work.update({
  where: { id: WORK_ID },
  data: {
    date_modified: template.date_created,
  },
});

let submissionVersionIndex = 0;

for (const workIndex of SUBMISSION_WORK_VERSION_INDICES) {
  const spec = SUBMISSION_STATUSES[submissionVersionIndex];
  const tag = `v${submissionVersionIndex + 1}`;
  const workVersionId = workVersionIds[workIndex]!;
  const wv = await prisma.workVersion.findUniqueOrThrow({ where: { id: workVersionId } });
  const datePublished = spec.published ? wv.date ?? wv.date_created : null;

  if (submissionVersionIndex === TOTAL_SUBMISSION_VERSIONS - 1) {
    await prisma.submissionVersion.update({
      where: { id: EXISTING_SUBMISSION_VERSION_ID },
      data: {
        work_version_id: workVersionId,
        date_created: wv.date_created,
        date_modified: wv.date_modified,
        date_published: datePublished,
        status: spec.status,
        tags: [tag],
      },
    });
  } else {
    await prisma.submissionVersion.create({
      data: {
        id: uuid(),
        submission_id: SUBMISSION_ID,
        work_version_id: workVersionId,
        submitted_by_id: SUBMITTED_BY_ID,
        date_created: wv.date_created,
        date_modified: wv.date_modified,
        date_published: datePublished,
        status: spec.status,
        tags: [tag],
      },
    });
  }

  submissionVersionIndex += 1;
}

const latestPublished = await prisma.submissionVersion.findFirst({
  where: { submission_id: SUBMISSION_ID, status: 'PUBLISHED' },
  orderBy: { date_created: 'desc' },
});

await prisma.submission.update({
  where: { id: SUBMISSION_ID },
  data: {
    date_published: latestPublished?.date_published ?? null,
    date_modified: latestPublished?.date_modified ?? template.date_created,
  },
});

const counts = await prisma.$transaction([
  prisma.workVersion.count({ where: { work_id: WORK_ID } }),
  prisma.submissionVersion.count({ where: { submission_id: SUBMISSION_ID } }),
]);

console.log('✅ Timeline test data ready');
console.log(`   Work ID: ${WORK_ID}`);
console.log(`   Submission ID: ${SUBMISSION_ID}`);
console.log(`   Work versions: ${counts[0]} (expected ${TOTAL_WORK_VERSIONS})`);
console.log(`   Submission versions: ${counts[1]} (expected ${TOTAL_SUBMISSION_VERSIONS})`);
console.log(`   Work timeline: /app/works/${WORK_ID}/versions`);
console.log(`   Submission timeline: /app/sites/scipy/submissions/${SUBMISSION_ID}/versions`);

await prisma.$disconnect();
