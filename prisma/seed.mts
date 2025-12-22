import { PrismaClient, SystemRole } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllJsonFilesFromDir, seedBySites } from './seed.utils.mjs';
import { uuidv7 } from 'uuidv7';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  const data: { site: any; works: any[] }[] = await loadAllJsonFilesFromDir(
    path.join(__dirname, 'data'),
  );

  const startDate = new Date(2023, 1, 1);
  const startDateString = startDate.toISOString();

  const rowanStaging = await prisma.user.create({
    data: {
      date_created: startDateString,
      date_modified: startDateString,
      id: '3gb5jtpcLuZLAqO2cYEgvmrymlN2',
      email: 'rowanc1@gmail.com',
      display_name: 'Rowan Cockett (STAGING ADMIN)',
      system_role: SystemRole.ADMIN,
    },
  });

  const steveStaging = await prisma.user.create({
    data: {
      date_created: startDateString,
      date_modified: startDateString,
      id: '17WdmI3lFHfXjIiWY56FSbxYRkS2',
      email: 'steve.purves@iooxa.com',
      display_name: 'Steve (staging ADMIN)',
      system_role: SystemRole.ADMIN,
    },
  });

  const franklin = await prisma.user.create({
    data: {
      date_created: startDateString,
      date_modified: startDateString,
      id: '1PbXjkhyiea6eVk4fY2gsfYcm8l1',
      email: 'franklin@curvenote.com',
      display_name: 'Franklin Koch (STAGING ADMIN)',
      system_role: SystemRole.ADMIN,
    },
  });

  const support = await prisma.user.create({
    data: {
      date_created: startDateString,
      date_modified: startDateString,
      id: 'mVkwApbQbKQ0ClO9A8ixYOP74JV2',
      email: 'support@curvenote.com',
      display_name: 'Curvenote Support',
      system_role: SystemRole.ADMIN,
    },
  });

  const mikeStaging = await prisma.user.create({
    data: {
      date_created: startDateString,
      date_modified: startDateString,
      id: '9FwyEySMmmV9lU8H9GpvcMfJ1fd2',
      email: 'mikemorrison@gmail.com',
      display_name: 'Mike Morrison (STAGING USER)',
      system_role: SystemRole.USER,
    },
  });

  // Create roles for development
  const platformAdminRole = await prisma.role.create({
    data: {
      id: 'platform-admin-role',
      name: 'platform-admin',
      title: 'Platform Admin',
      description: 'Provides access to the platform administration area',
      scopes: ['app:platform:admin'],
      createdBy: franklin.id,
      date_created: startDateString,
      date_modified: startDateString,
    },
  });

  const myWorksPreviewRole = await prisma.role.create({
    data: {
      id: 'my-works-preview-role',
      name: 'my-works-preview',
      title: 'My Works Preview',
      description: 'Access to the My Works feature and upload functionality',
      scopes: ['app:works:feature', 'app:works:upload'],
      createdBy: franklin.id,
      date_created: startDateString,
      date_modified: startDateString,
    },
  });

  // Assign roles to all users except Support for admin roles
  const usersToAssignRoles = [franklin, rowanStaging, steveStaging, mikeStaging];

  for (const user of usersToAssignRoles) {
    // Assign Platform Admin role
    await prisma.userRole.create({
      data: {
        id: uuidv7(),
        user_id: user.id,
        role_id: platformAdminRole.id,
        date_created: startDateString,
        date_modified: startDateString,
      },
    });
  }

  // Assign My Works Preview role to ALL users including support
  const allUsers = [franklin, rowanStaging, steveStaging, mikeStaging, support];
  for (const user of allUsers) {
    await prisma.userRole.create({
      data: {
        id: uuidv7(),
        user_id: user.id,
        role_id: myWorksPreviewRole.id,
        date_created: startDateString,
        date_modified: startDateString,
      },
    });
  }

  await seedBySites(data, startDateString, {
    support,
    others: [franklin, rowanStaging, steveStaging, mikeStaging],
    tellus: [mikeStaging],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
