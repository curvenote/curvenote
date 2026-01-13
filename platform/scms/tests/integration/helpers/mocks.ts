import { Authenticator } from 'remix-auth';
import { createCookieSessionStorage } from 'react-router';
import type { AuthenticatedUserWithProviderCookie, sites } from '@curvenote/scms-server';
import {
  Context,
  SiteContext,
  getPrismaClient,
  dbCreateUserWithPrimaryLinkedAccount,
  // dbAddSiteUserRole,
} from '@curvenote/scms-server';
import { SiteRole } from '@prisma/client';
import { uuidv7 } from 'uuidv7';

export function createMockConfig() {
  return {
    api: {
      propertyPublicKey: 'test-key',
      privateCDNSigningInfo: {},
      privateSiteClaimSubject: 'test-subject',
      previewIssuer: 'test-issuer',
      previewSigningSecret: 'test-secret',
      handshakeIssuer: 'test-issuer',
      handshakeSigningSecret: 'test-secret',
      submissionsServiceAccount: { id: 'test-id' },
    },
  };
}

export function createMockSessionStorage() {
  return createCookieSessionStorage({
    cookie: {
      name: '__session',
      secrets: ['test-secret'],
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 7 * 4,
    },
  });
}

export function createMockAuthenticator() {
  return new Authenticator<AuthenticatedUserWithProviderCookie>();
}

export function createMockRequest() {
  return new Request('http://localhost');
}

export function createMockSite(siteId: string = 'test-site-id'): sites.DBO {
  return {
    id: siteId,
    name: 'test-site',
    title: 'Test Site',
    private: false,
    date_created: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    metadata: {},
    external: false,
    restricted: true,
    default_workflow: 'SIMPLE',
    slug_strategy: 'NONE',
    description: null,
    submissionKinds: [],
    collections: [],
    domains: [],
    content_id: null,
    data: {},
    occ: 0,
  };
}

export function createMockContext(siteId?: string) {
  const config = createMockConfig();
  const sessionStorage = createMockSessionStorage();
  const auth = createMockAuthenticator();
  const request = createMockRequest();
  const site = createMockSite(siteId);
  const context = new SiteContext(new Context(config as any, auth, sessionStorage, request), site);
  context.$verifiedSession = true;
  return context;
}

export interface TestData {
  userId: string;
  siteId: string;
  siteName: string;
  kindId: string;
  collectionId: string;
  workId: string;
  workVersionId: string;
  submissionId: string;
  context: ReturnType<typeof createMockContext>;
}

export async function createTestData(siteRole: SiteRole): Promise<TestData> {
  // Validate the site role
  if (!Object.values(SiteRole).includes(siteRole)) {
    throw new Error(
      `Invalid site role: ${siteRole}. Must be one of: ${Object.values(SiteRole).join(', ')}`,
    );
  }

  // Generate UUIDv7 for each entity
  const userId = uuidv7();
  const siteId = uuidv7();
  const siteName = `test-site-${siteId}`;
  const kindId = uuidv7();
  const collectionId = uuidv7();
  const workId = uuidv7();
  const workVersionId = uuidv7();
  const submissionId = uuidv7();

  // Create mock context with the test site ID
  const context = createMockContext(siteId);

  const prisma = await getPrismaClient();

  // Create a test user with linked account and site role
  await dbCreateUserWithPrimaryLinkedAccount({
    id: userId,
    email: 'test@example.com',
    username: 'testuser',
    primaryProvider: 'local',
    displayName: 'Test User',
    profile: { id: userId },
  });

  // Get the created user from the database
  const createdUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      site_roles: {
        include: {
          site: true,
        },
      },
      work_roles: true,
      created_works: true,
      submissionVersions: true,
      submissionActivity: true,
      submission: true,
      ApiEvent: true,
      linkedAccounts: true,
      userTokens: true,
    },
  });

  if (!createdUser) {
    throw new Error('Failed to create test user');
  }

  // Update the mock context with the real user
  (context as any).user = {
    ...createdUser,
    email_verified: true,
  };

  // Create a test site with a unique name
  const site = await prisma.site.upsert({
    where: { name: siteName },
    create: {
      id: siteId,
      name: siteName,
      title: 'Test Site',
      private: false,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      metadata: {},
      external: false,
      restricted: true,
      default_workflow: 'SIMPLE',
      slug_strategy: 'NONE',
      description: null,
    },
    update: {},
  });

  // Update the mock context with the real site
  context.site = {
    ...site,
    submissionKinds: [],
    collections: [],
    domains: [],
  };

  // Add the user with the specified role to the site
  // await dbAddSiteUserRole(siteId, userId, siteRole);
  await prisma.siteUser.create({
    data: {
      id: uuidv7(),
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      site_id: siteId,
      user_id: userId,
      role: siteRole,
    },
  });

  // Refresh the user in the context to include the new site role
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      site_roles: {
        include: {
          site: true,
        },
      },
      work_roles: true,
      created_works: true,
      submissionVersions: true,
      submissionActivity: true,
      submission: true,
      ApiEvent: true,
      linkedAccounts: true,
      userTokens: true,
    },
  });

  if (!updatedUser) {
    throw new Error('Failed to refresh test user');
  }

  // Update the mock context with the refreshed user
  (context as any).user = {
    ...updatedUser,
    email_verified: true,
  };

  // Create a test submission kind
  const kind = await prisma.submissionKind.create({
    data: {
      id: kindId,
      name: `Test Kind ${kindId}`,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      default: true,
      content: {},
      site: { connect: { id: site.id } },
    },
  });

  // Create a test collection with a unique slug
  const collection = await prisma.collection.create({
    data: {
      id: collectionId,
      name: `Test Collection ${collectionId}`,
      slug: `test-collection-${collectionId}`,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      content: {},
      site: { connect: { id: site.id } },
    },
  });

  // Create a test work
  const work = await prisma.work.create({
    data: {
      id: workId,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      created_by: { connect: { id: userId } },
    },
  });

  // Create a test work version
  await prisma.workVersion.create({
    data: {
      id: workVersionId,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      title: 'Test Work Version',
      work: { connect: { id: work.id } },
      cdn: 'https://test-cdn.com',
      cdn_key: 'test-key',
      authors: [],
    },
  });

  // Create a test submission
  await prisma.submission.create({
    data: {
      id: submissionId,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      site: { connect: { id: site.id } },
      work: { connect: { id: work.id } },
      submitted_by: { connect: { id: userId } },
      kind: { connect: { id: kind.id } },
      collection: { connect: { id: collection.id } },
    },
  });

  return {
    userId,
    siteId,
    siteName,
    kindId,
    collectionId,
    workId,
    workVersionId,
    submissionId,
    context,
  };
}
