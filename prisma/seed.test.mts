import { PrismaClient, SystemRole, JobStatus } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllJsonFilesFromDir, seedBySites } from './seed.utils.mjs';
import idPool from './ids.json';
import { uuidv7 } from 'uuidv7';

const QUIET = true; // Set to true to suppress console output

function log(...args: any[]) {
  if (!QUIET) {
    console.log(...args);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  const dateOne = new Date(2023, 1, 1);
  const dateOneString = dateOne.toISOString();
  const dateTwo = new Date(2023, 1, 2);
  const dateTwoString = dateTwo.toISOString();

  await prisma.user.create({
    data: {
      date_created: dateOneString,
      date_modified: dateOneString,
      id: '018b9034-d660-7a20-9135-5794c1eb0bfb',
      email: 'submissions@curvenote.com',
      display_name: 'Curvenote Submissions',
      system_role: SystemRole.SERVICE,
    },
  });

  const support = await prisma.user.create({
    data: {
      date_created: dateOneString,
      date_modified: dateOneString,
      id: 'mVkwApbQbKQ0ClO9A8ixYOP74JV2',
      email: 'support@curvenote.com',
      display_name: 'Curvenote Support',
      system_role: SystemRole.ADMIN,
    },
  });

  const userOne = await prisma.user.create({
    data: {
      date_created: dateOneString,
      date_modified: dateOneString,
      id: '3gb5jtpcLuZLAqO2cYEgvmrymlN2',
      email: 'rowanc1@gmail.com',
      display_name: 'Rowan (SYS ADMIN)',
      system_role: SystemRole.USER,
    },
  });

  const userTwo = await prisma.user.create({
    data: {
      date_created: dateOneString,
      date_modified: dateOneString,
      id: '17WdmI3lFHfXjIiWY56FSbxYRkS2',
      email: 'steve.purves@iooxa.com',
      display_name: 'Steve (SYS USER)',
      system_role: SystemRole.USER,
    },
  });

  // Create platform admin role for testing
  const platformAdminRole = await prisma.role.create({
    data: {
      id: 'test-platform-admin-role',
      name: 'platform-admin',
      title: 'Platform Admin',
      description: 'Provides access to the platform administration area',
      scopes: ['app:platform:admin'],
      createdBy: support.id,
      date_created: dateOneString,
      date_modified: dateOneString,
    },
  });

  // Assign platform admin role to userOne (for platform admin tests)
  await prisma.userRole.create({
    data: {
      id: uuidv7(),
      user_id: userOne.id,
      role_id: platformAdminRole.id,
      date_created: dateOneString,
      date_modified: dateOneString,
    },
  });

  const data: { site: any; works: any[] }[] = await loadAllJsonFilesFromDir(
    path.join(__dirname, 'data.test'),
  );

  await seedBySites(data, dateOneString, { support, others: [userOne, userTwo], tellus: [] });

  // Add a test job
  await prisma.job.create({
    data: {
      id: '018b9034-d660-7a20-9135-5794c1eb0bfc',
      date_created: dateOneString,
      date_modified: dateOneString,
      job_type: 'CHECK',
      status: JobStatus.COMPLETED,
      payload: {
        submissionVersionId: idPool.submission_versions[0],
        checkType: 'test',
      },
      messages: ['Test job completed successfully'],
      results: {
        passed: true,
        details: 'Test job results',
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    if (!QUIET) {
      console.error(e);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
