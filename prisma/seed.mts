import { SystemRole, getLowLevelPrismaClient } from '@curvenote/scms-db';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllJsonFilesFromDir, seedBySites } from './seed.utils.mjs';
import { uuidv7 } from 'uuidv7';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = await getLowLevelPrismaClient();

// Track what we've created for the summary
const summary = {
  users: 0,
  roles: 0,
  userRoles: 0,
  sites: 0,
  works: 0,
  submissions: 0,
  collections: 0,
};

console.log('🌱 Starting database seed...\n');

async function main() {
  console.log('📂 Loading seed data files...');
  const data: { site: any; works: any[] }[] = await loadAllJsonFilesFromDir(
    path.join(__dirname, 'data'),
  );
  console.log(`   ✓ Loaded ${data.length} site data file(s)\n`);

  const startDate = new Date(2023, 1, 1);
  const startDateString = startDate.toISOString();

  console.log('👥 Creating users...');

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
  summary.users++;
  console.log(`   ✓ Created user: ${rowanStaging.display_name} (${rowanStaging.email})`);

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
  summary.users++;
  console.log(`   ✓ Created user: ${steveStaging.display_name} (${steveStaging.email})`);

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
  summary.users++;
  console.log(`   ✓ Created user: ${franklin.display_name} (${franklin.email})`);

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
  summary.users++;
  console.log(`   ✓ Created user: ${support.display_name} (${support.email})`);

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
  summary.users++;
  console.log(`   ✓ Created user: ${mikeStaging.display_name} (${mikeStaging.email})`);
  console.log(`   Total users created: ${summary.users}\n`);

  console.log('🔐 Creating roles...');
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
  summary.roles++;
  console.log(`   ✓ Created role: ${platformAdminRole.title} (${platformAdminRole.name})`);

  const myWorksPreviewScopes = ['app:works:feature', 'app:works:upload', 'app:works:export'];
  const myWorksPreviewRole = await prisma.role.upsert({
    where: { name: 'my-works-preview' },
    create: {
      id: 'my-works-preview-role',
      name: 'my-works-preview',
      title: 'My Works Preview',
      description: 'Access to the My Works feature and upload functionality',
      scopes: myWorksPreviewScopes,
      createdBy: franklin.id,
      date_created: startDateString,
      date_modified: startDateString,
    },
    update: {
      scopes: myWorksPreviewScopes,
      date_modified: startDateString,
    },
  });
  summary.roles++;
  console.log(
    `   ✓ Created/updated role: ${myWorksPreviewRole.title} (${myWorksPreviewRole.name})`,
  );
  console.log(`   Total roles created: ${summary.roles}\n`);

  console.log('🔗 Assigning roles to users...');
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
    summary.userRoles++;
    console.log(`   ✓ Assigned ${platformAdminRole.title} to ${user.display_name}`);
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
    summary.userRoles++;
    console.log(`   ✓ Assigned ${myWorksPreviewRole.title} to ${user.display_name}`);
  }
  console.log(`   Total role assignments: ${summary.userRoles}\n`);

  console.log('🏗️  Seeding sites, works, and submissions...\n');
  const siteSummary = await seedBySites(data, startDateString, {
    support,
    others: [franklin, rowanStaging, steveStaging, mikeStaging],
  });

  // Merge site summary into main summary
  summary.sites += siteSummary.sites;
  summary.works += siteSummary.works;
  summary.submissions += siteSummary.submissions;
  summary.collections += siteSummary.collections;
}

main()
  .then(async () => {
    await prisma.$disconnect();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SEED COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   👥 Users:        ${summary.users}`);
    console.log(`   🔐 Roles:        ${summary.roles}`);
    console.log(`   🔗 User Roles:   ${summary.userRoles}`);
    console.log(`   🏢 Sites:        ${summary.sites}`);
    console.log(`   📄 Works:        ${summary.works}`);
    console.log(`   📝 Submissions:  ${summary.submissions}`);
    console.log(`   📚 Collections:  ${summary.collections}`);
    console.log('\n' + '='.repeat(60) + '\n');

    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n❌ Seed failed with error:');
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
