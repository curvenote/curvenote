import type { Prisma } from '@curvenote/scms-db';
import { getLowLevelPrismaClient, SiteRole, ActivityType, WorkRole } from '@curvenote/scms-db';
import fs from 'fs/promises';
import path from 'path';
import { uuidv7 as uuid } from 'uuidv7';

const DEFAULT_CHECKS: string[] = [];
const QUIET = true; // Set to true to suppress console output

const prisma = await getLowLevelPrismaClient();

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

      const versions = work.versions.map((version: any) => ({
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

      const workSubmissionVersions = workData.versions
        .filter(({ canonical }: { canonical: boolean | null }) => !!canonical)
        .map((version: any) => ({
          id: uuid(),
          date_created: version.date_created,
          date_published: version.date || version.date_created,
          status: 'PUBLISHED',
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
              date_published: version.date || version.date_created,
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
        }));

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

    console.log(`   📝 Creating submissions and activities...`);
    const subData = await Promise.all(
      submissionVersions.map(async (sv, i) => {
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
            submission: {
              create: {
                ...sv.submission.create,
                date_modified: sv.submission.create.date_created ?? sv.date_created,
                collection: {
                  connect: {
                    id:
                      collections.find((c) => c.name === item.works[i].collection)?.id ??
                      collections[0].id,
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

        return subVersion;
      }),
    );
    summary.submissions += subData.length;
    console.log(`   ✓ Created ${subData.length} submission(s) with activity records`);
    console.log(`   ✅ Completed site: ${item.site.name}\n`);
  }

  return summary;
}
