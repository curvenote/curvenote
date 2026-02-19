import type { Prisma } from '@curvenote/scms-db';
import { getLowLevelPrismaClient, SiteRole, ActivityType, WorkRole } from '@curvenote/scms-db';
import fs from 'fs/promises';
import path from 'path';
import { uuidv7 as uuid } from 'uuidv7';

const DEFAULT_CHECKS: string[] = [];
const QUIET = true; // Set to true to suppress console output

const prisma = await getLowLevelPrismaClient();

/** Seeded RNG (mulberry32) for deterministic version dates and submission indices. */
function createSeededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h = (h << 0) >>> 0;
  }
  return function () {
    h = Math.imul(h ^ (h >>> 15), h | 0);
    h = Math.imul(h ^ (h >>> 7), h | 0);
    return ((h ^ (h >>> 13)) >>> 0) / 0xffffffff;
  };
}

/**
 * Generate version_count work versions over ~6 months ending at publication date,
 * with submission_version_count of them also having submissions (always including the last version).
 * Returns { versions, submissionVersionEntries } for use in seed.
 */
function generateWorkVersions(
  work: {
    id: string;
    title: string;
    description?: string;
    authors: string[];
    date: string;
    version_count: number;
    submission_version_count: number;
    version_template?: { cdn_key?: string; cdn?: string };
  },
  uuid: () => string,
): {
  versions: Array<{
    id: string;
    date_created: string;
    date_modified: string;
    cdn_key: string | undefined;
    cdn: string | undefined;
    title: string;
    description: string | undefined;
    authors: string[];
    date: string | undefined;
    doi: string | undefined;
    canonical: boolean;
  }>;
  submissionVersionEntries: Array<{ workVersionIndex: number; status: 'DRAFT' | 'PUBLISHED' }>;
} {
  const rng = createSeededRng(work.id);
  const pubDate = new Date(work.date);
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const count = work.version_count;
  // count versions with at least 1 month between each = (count-1) gaps of 30 days
  const windowMs = count * oneMonthMs;
  const startDate = new Date(pubDate.getTime() - windowMs);

  // (count-1) timestamps in non-overlapping 30-day slots (at least 1 month apart), then pub as last
  const randomDates: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const slotStart = startDate.getTime() + i * oneMonthMs;
    const slotEnd = slotStart + oneMonthMs;
    randomDates.push(slotStart + rng() * (slotEnd - slotStart - 1)); // random within slot, leave gap
  }
  const sortedDates = [...randomDates, pubDate.getTime()];

  // 3 PUBLISHED + 4 DRAFT = 7 submission versions; 1 work version has 2 SVs (DRAFT + PUBLISHED)
  // Latest work version (count-1) must have a PUBLISHED submission version
  // Distribute the other 5 work version indices evenly between second (1) and last (count-1)
  const rangeStart = 1;
  const rangeEnd = count - 2; // exclude latest (count-1) for these 5; latest gets PUBLISHED separately
  const numSlots = 5;
  const evenlySpacedIndices: number[] = [];
  for (let i = 0; i < numSlots; i++) {
    const t = numSlots === 1 ? 0.5 : i / (numSlots - 1);
    evenlySpacedIndices.push(
      Math.min(rangeEnd, rangeStart + Math.round(t * (rangeEnd - rangeStart))),
    );
  }
  // Assign which of the 5 is doubleIdx (2 SVs), which 3 are DRAFT-only, which 1 is PUBLISHED-only (shuffle with rng)
  const shuffled = [...evenlySpacedIndices].sort(() => rng() - 0.5);
  const doubleIdx = shuffled[0];
  const draftOnlyIndices = [shuffled[1], shuffled[2], shuffled[3]];
  const publishedOnlyIdx = shuffled[4];
  const submissionVersionEntries: Array<{ workVersionIndex: number; status: 'DRAFT' | 'PUBLISHED' }> = [
    { workVersionIndex: doubleIdx, status: 'DRAFT' },
    { workVersionIndex: doubleIdx, status: 'PUBLISHED' },
    { workVersionIndex: draftOnlyIndices[0], status: 'DRAFT' },
    { workVersionIndex: draftOnlyIndices[1], status: 'DRAFT' },
    { workVersionIndex: draftOnlyIndices[2], status: 'DRAFT' },
    { workVersionIndex: publishedOnlyIdx, status: 'PUBLISHED' },
    { workVersionIndex: count - 1, status: 'PUBLISHED' }, // latest work version always has PUBLISHED
  ].sort((a, b) => a.workVersionIndex - b.workVersionIndex);

  const template = work.version_template ?? {};
  const versions = sortedDates.map((ts, i) => {
    const dateCreated = new Date(ts).toISOString();
    const isLast = i === count - 1;
    return {
      id: uuid(),
      date_created: dateCreated,
      date_modified: dateCreated,
      cdn_key: template.cdn_key,
      cdn: template.cdn,
      title: work.title,
      description: work.description,
      authors: work.authors,
      author_details: [],
      date: isLast ? work.date : undefined,
      doi: undefined,
      canonical: isLast, // only the latest work version is canonical
    };
  });

  return { versions, submissionVersionEntries };
}

function log(...args: any[]) {
  if (!QUIET) {
    console.log(...args);
  }
}

export async function loadAllJsonFilesFromDir(directoryPath: string): Promise<any[]> {
  try {
    // Read the directory to get all filenames
    const filenames: string[] = await fs.readdir(directoryPath);

    // Filter the filenames to get only JSON files
    const jsonFilenames: string[] = filenames.filter(
      (filename) => path.extname(filename) === '.json',
    );

    // Load and parse each JSON file
    const jsonFiles: any[] = [];
    for (const filename of jsonFilenames) {
      const fileContent: string = await fs.readFile(path.join(directoryPath, filename), 'utf-8');
      jsonFiles.push(JSON.parse(fileContent));
    }

    return jsonFiles;
  } catch (error) {
    console.error('Error loading JSON files:', error);
    throw error;
  }
}

export async function seedBySites(
  data: any,
  startDateString: string,
  users: {
    support: Prisma.UserGetPayload<any>;
    others: Prisma.UserGetPayload<any>[];
  },
): Promise<{ sites: number; works: number; submissions: number; collections: number }> {
  const summary = {
    sites: 0,
    works: 0,
    submissions: 0,
    collections: 0,
  };

  for (const item of data) {
    item.site.id ??= uuid();
    console.log(`\n📦 Processing site: ${item.site.name || item.site.title || 'Untitled'}`);
    let submissionVersions: any[] = [];
    let workCount = 0;

    for (const work of item.works) {
      workCount++;
      console.log(
        `   📄 Creating work ${workCount}/${item.works.length}: ${work.title || work.id}`,
      );

      let submissionVersionEntries:
        | Array<{ workVersionIndex: number; status: 'DRAFT' | 'PUBLISHED' }>
        | undefined;
      const versions: Array<{
        id: string;
        date_created: string;
        date_modified: string;
        cdn_key?: string;
        cdn?: string;
        title: string;
        description?: string;
        authors: string[];
        date?: string;
        doi?: string;
        canonical: boolean;
      }> = work.version_count
        ? (() => {
            const { versions: gen, submissionVersionEntries: entries } = generateWorkVersions(
              work,
              uuid,
            );
            submissionVersionEntries = entries;
            return gen;
          })()
        : work.versions.map((version: any) => ({
            date_created: new Date(version.date_created).toISOString(),
            date_modified: new Date(version.date_created).toISOString(),
            id: version.id,
            cdn_key: version.cdn_key,
            cdn: version.cdn,
            title: work.title,
            description: work.description,
            authors: work.authors,
            date: work.date,
            doi: version.doi,
            canonical: version.canonical,
          }));

      const workData = await prisma.work.upsert({
        where: {
          id: work.id,
        },
        create: {
          id: work.id,
          doi: work.doi,
          date_created: versions[0].date_created,
          date_modified: versions[0].date_created,
          versions: {
            create: versions,
          },
          created_by: {
            connect: { id: users.support.id },
          },
          work_users: {
            create: [
              {
                id: uuid(),
                date_created: versions[0].date_created,
                date_modified: versions[0].date_created,
                user_id: users.support.id,
                role: WorkRole.OWNER,
              },
            ],
          },
        },
        update: {},
        include: {
          versions: true,
        },
      });

      const workIndex = workCount - 1;
      const versionsToSubmitWithStatus: Array<{ version: any; status: 'DRAFT' | 'PUBLISHED' }> =
        work.version_count && submissionVersionEntries
          ? submissionVersionEntries
              .map((entry) => ({
                version: workData.versions[entry.workVersionIndex],
                status: entry.status,
              }))
              .sort(
                (a, b) =>
                  new Date(a.version.date_created).getTime() -
                  new Date(b.version.date_created).getTime(),
              )
          : workData.versions
              .filter(({ canonical }: { canonical: boolean | null }) => !!canonical)
              .map((version: any) => ({ version, status: 'PUBLISHED' as const }));
      // First SV (earliest date) will create the Submission, so Submission date_created aligns with first submission version
      const workSubmissionVersions = versionsToSubmitWithStatus.map(
        ({ version, status }: { version: any; status: 'DRAFT' | 'PUBLISHED' }) => ({
          workIndex,
          id: uuid(),
          date_created: version.date_created,
          date_published: status === 'PUBLISHED' ? (version.date || version.date_created) : undefined,
          status,
          submitted_by: {
            connect: { id: users.support.id },
          },
          work_version: {
            connect: {
              id: version.id,
            },
          },
          submission: {
            create: {
              id: uuid(),
              submitted_by: {
                connect: { id: users.support.id },
              },
              date_created: version.date_created,
              date_published:
                status === 'PUBLISHED' ? (version.date || version.date_created) : undefined,
              kind: work.kind,
              site: {
                connect: {
                  id: item.site.id,
                },
              },
              work: {
                connect: {
                  id: workData.id,
                },
              },
            },
          },
          job_id: work.job?.id,
        }),
      );

      submissionVersions = [...submissionVersions, ...workSubmissionVersions];

      summary.works++;
      console.log(`      ✓ Created work: ${workData.id} (${workData.versions.length} version(s))`);

      if (work.job) {
        const job = await prisma.job.create({
          data: {
            id: work.job.id,
            date_created: startDateString,
            date_modified: startDateString,
            job_type: work.job.job_type,
            status: work.job.status,
            payload: work.job.payload,
            results: {
              ...work.job.results,
              submissionVersionId: workSubmissionVersions[0].id,
              submissionId: workSubmissionVersions[0].submission.create.id,
            },
          },
        });

        console.log(`      ✓ Created build job: ${job.id}`);
      }
    }
    console.log(`   ✓ Processed ${workCount} work(s) for site ${item.site.name}`);

    console.log(`   🏢 Creating site: ${item.site.name || item.site.title || 'Untitled'}`);
    const siteUsers = [
      {
        id: uuid(),
        date_created: startDateString,
        date_modified: startDateString,
        user_id: users.support.id,
        role: SiteRole.ADMIN,
      },
      ...users.others.map((user) => ({
        id: uuid(),
        date_created: startDateString,
        date_modified: startDateString,
        user_id: user.id,
        role: SiteRole.ADMIN,
      })),
    ];

    if (item.url === undefined) throw new Error('URL is required');
    if (item.private === undefined) throw new Error('Private is required');

    const siteData = await prisma.site.create({
      data: {
        id: item.site.id,
        date_created: startDateString,
        date_modified: startDateString,
        name: item.site.name,
        default_workflow: item.site.default_workflow,
        title: item.site.title,
        private: item.private ?? false,
        restricted: item.site.restricted ?? true,
        description: item.site.description,
        slug_strategy: item.site.slug_strategy,
        metadata: item.site,
        submissionKinds: {
          create: item.site.kinds.map((kind: any) => ({
            id: kind.id ?? uuid(),
            name: kind.name,
            content: kind.content ?? {},
            default: kind.default ?? false,
            date_created: startDateString,
            date_modified: startDateString,
            checks: kind.checks ?? DEFAULT_CHECKS,
          })),
        },
        site_users: {
          create: siteUsers,
        },
      },
      include: {
        submissions: true,
        submissionKinds: true,
      },
    });
    summary.sites++;
    console.log(
      `   ✓ Created site: ${siteData.name} (${siteData.submissionKinds.length} submission kind(s))`,
    );

    console.log(`   📚 Creating collections...`);

    const collectionData = item.site.collections ?? [
      {
        id: uuid(),
        name: 'articles',
        slug: '',
        workflow: item.site.default_workflow,
        content: {
          title: 'Articles',
          description: `A collection of research articles`,
        },
        open: true,
        default: true,
      },
    ];

    await prisma.collection.createMany({
      data: collectionData.map((c: any) => ({
        ...c,
        date_created: startDateString,
        date_modified: startDateString,
        site_id: siteData.id,
      })),
    });
    summary.collections += collectionData.length;
    console.log(`      ✓ Created ${collectionData.length} collection(s)`);

    const collections = await prisma.collection.findMany({ where: { site_id: siteData.id } });
    const kinds = await prisma.submissionKind.findMany({ where: { site_id: siteData.id } });

    await Promise.all(
      collections.map(async (collection) => {
        await Promise.all(
          kinds.map(async (kind) => {
            return prisma.kindsInCollections.create({
              data: {
                id: uuid(),
                date_created: startDateString,
                date_modified: startDateString,
                kind: {
                  connect: {
                    id: kind.id,
                  },
                },
                collection: {
                  connect: {
                    id: collection.id,
                  },
                },
              },
            });
          }),
        );
      }),
    );

    console.log(`   ✓ Linked collections to submission kinds`);
    const domain = await prisma.domain.create({
      data: {
        id: uuid(),
        date_created: startDateString,
        date_modified: startDateString,
        hostname: new URL(item.url).hostname,
        site: {
          connect: {
            id: siteData.id,
          },
        },
      },
    });
    console.log(`   ✓ Created domain: ${domain.hostname}`);

    if (siteData.name === 'scipy') {
      const defaultKind =
        siteData.submissionKinds.find((k: { default: boolean }) => k.default) ??
        siteData.submissionKinds[0];
      const defaultCollection = collections[0];
      const formId = uuid();
      await prisma.submissionForm.create({
        data: {
          id: formId,
          date_created: startDateString,
          date_modified: startDateString,
          name: 'Article',
          site_id: siteData.id,
          kind_id: defaultKind.id,
          data: { title: 'Article', description: 'Submit an article' },
        },
      });
      await prisma.collectionsInForms.create({
        data: {
          id: uuid(),
          date_created: startDateString,
          date_modified: startDateString,
          collection_id: defaultCollection.id,
          form_id: formId,
        },
      });
      console.log(`   ✓ Created form "Article" for scipy`);
    }

    console.log(`   📝 Creating submissions and activities...`);
    // One Submission per work: first submission version for each work creates the submission;
    // subsequent submission versions for the same work connect to it.
    const submissionIdsByWorkIndex: Record<number, string> = {};
    const sortedSubmissionVersions = [...submissionVersions].sort(
      (a, b) => a.workIndex - b.workIndex,
    );
    const subData: Awaited<ReturnType<typeof prisma.submissionVersion.create>>[] = [];
    for (const sv of sortedSubmissionVersions) {
      const isFirstForWork = submissionIdsByWorkIndex[sv.workIndex] === undefined;
      const subVersion = await prisma.submissionVersion.create({
        data: {
          id: sv.id,
          date_created: sv.date_created,
          date_modified: sv.date_created,
          status: sv.status,
          submitted_by: {
            connect: {
              id: sv.submitted_by.connect.id,
            },
          },
          work_version: {
            connect: {
              id: sv.work_version.connect.id,
            },
          },
          submission: isFirstForWork
            ? {
                create: {
                  ...sv.submission.create,
                  date_modified: sv.submission.create.date_created ?? sv.date_created,
                  collection: {
                    connect: {
                      id:
                        collections.find(
                          (c) => c.name === item.works[sv.workIndex]?.collection,
                        )?.id ?? collections[0].id,
                    },
                  },
                  kind: {
                    connect: {
                      id: siteData.submissionKinds.find((kind) => {
                        return kind.name === sv.submission.create.kind;
                      })!.id,
                    },
                  },
                  site: {
                    connect: {
                      id: siteData.id,
                    },
                  },
                },
              }
            : {
                connect: {
                  id: submissionIdsByWorkIndex[sv.workIndex],
                },
              },
          job: sv.job_id
            ? {
                connect: {
                  id: sv.job_id,
                },
              }
            : undefined,
        },
        include: {
          submission: true,
        },
      });
      if (isFirstForWork) {
        submissionIdsByWorkIndex[sv.workIndex] = subVersion.submission_id;
      }
      subData.push(subVersion);

      await prisma.activity.create({
        data: {
          id: uuid(),
          date_created: sv.date_created,
          date_modified: sv.date_created,
          activity_by: {
            connect: {
              id: subVersion.submitted_by_id,
            },
          },
          submission: {
            connect: {
              id: subVersion.submission_id,
            },
          },
          submission_version: {
            connect: {
              id: subVersion.id,
            },
          },
          activity_type: ActivityType.NEW_SUBMISSION,
          status: subVersion.status,
          work_version: {
            connect: {
              id: subVersion.work_version_id,
            },
          },
          kind: {
            connect: {
              id: subVersion.submission.kind_id,
            },
          },
        },
      });
    }
    const uniqueSubmissionCount = new Set(subData.map((s) => s.submission_id)).size;
    summary.submissions += uniqueSubmissionCount;
    console.log(
      `   ✓ Created ${uniqueSubmissionCount} submission(s), ${subData.length} submission version(s) with activity records`,
    );
    console.log(`   ✅ Completed site: ${item.site.name}\n`);
  }

  return summary;
}
