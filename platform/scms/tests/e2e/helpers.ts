// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'vitest';
import jwt from 'jsonwebtoken';
import type { $Enums } from '@curvenote/scms-db';
import { JobStatus, PrismaClient, SystemRole } from '@prisma/client';
import { createSessionToken } from '@curvenote/scms-server';
import { KnownJobTypes } from '@curvenote/scms-core';
import { loadValidatedConfig } from '@app-config/config';
import type { UserDBO } from '@curvenote/scms-server';

// Initialize Prisma with test database configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Log database connection on initialization
console.log('Initializing Prisma with database URL:', process.env.DATABASE_URL);

const PORT = 3032;

// Track test users for cleanup
const testUserIds: string[] = [];

interface TestUser {
  id: string;
  email: string;
  email_verified: boolean;
  display_name: string;
}

export const users: Record<string, TestUser> = {
  support: {
    id: 'mVkwApbQbKQ0ClO9A8ixYOP74JV2',
    email: 'support@curvenote.com',
    email_verified: true,
    display_name: 'Curvenote Support',
  },
  steve: {
    id: '17WdmI3lFHfXjIiWY56FSbxYRkS2',
    email: 'steve@curvenote.com',
    email_verified: true,
    display_name: 'Steve (STAGING)',
  },
};

export async function apiFetch(url: string, init?: RequestInit) {
  return fetch(`http://localhost:${PORT}/v1/${url}`, init);
}

export async function expectSuccess(url: string, init?: RequestInit) {
  const res = await fetch(`http://localhost:${PORT}/v1/${url}`, init);
  if (res.status > 299) console.log(res.status, res.statusText);
  expect(res.status).toEqual(200);
  return res;
}

export async function expectStatus(status: number, url: string, init?: RequestInit) {
  const res = await fetch(`http://localhost:${PORT}/v1/${url}`, init);
  expect(res.status).toEqual(status);
  return res;
}

const tokenCache: Record<string, string> = {};

export async function getToken(user: TestUser) {
  if (tokenCache[user.id]) return tokenCache[user.id];
  try {
    const { id, email, email_verified, display_name } = user;
    const token = signCurvenoteToken({ id, email, email_verified, display_name }, 'qwerty');
    tokenCache[user.id] = token;
    return token;
  } catch (error) {
    console.log(error);
  }
}

export interface TokenOptions {
  user_id: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

function signCurvenoteToken(
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    display_name: string;
  },
  signingKey: string,
) {
  const expiresIn = 60 * 60 * 1000;
  const audience = 'https://api.curvenote.one/';
  const issuer = 'https://api.curvenote.one/tokens/session';

  const options: jwt.SignOptions = {
    expiresIn: expiresIn ?? 0,
    audience,
    issuer,
    subject: user.id,
  };

  const jwtToken = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      email_verified: user.email_verified,
      name: user.display_name,
      ignoreExpiration: false,
    },
    signingKey,
    options,
  );
  return jwtToken;
}

export function getPrivateSiteToken(siteName: string, key: string) {
  const expiry = Date.now() / 1000 + 60 * 30;
  const payload = {
    sub: 'curvenote.private.site',
    iss: siteName,
    aud: 'test.suite',
    exp: expiry,
    name: siteName,
    user: 'user1',
  };

  return jwt.sign(payload, key, { algorithm: 'HS256' });
}

export function expectSubmissionVersion(version: any) {
  expect(version).toMatchObject({
    id: expect.any(String),
    date_created: expect.any(String),
    site_name: expect.any(String),
    status: expect.stringMatching(/PUBLISHED|REJECTED|REMOVED|APPROVED|PENDING/),
    submission_id: expect.any(String),
    submitted_by: {
      id: expect.any(String),
      name: expect.any(String),
    },

    work_version: {
      id: expect.any(String),
      version_id: expect.any(String),
      title: expect.any(String),
      date: expect.any(String),
      authors: expect.arrayContaining([
        {
          name: expect.any(String),
        },
      ]),
      canonical: expect.any(Boolean),
      cdn: expect.stringContaining('https://'),
      key: expect.any(String),
      date_created: expect.any(String),
      description: expect.any(String),
      links: expect.any(Object),
      kind: expect.stringMatching(/Original/),
    },
    links: expect.any(Object),
  });
}

export function expectSubmission(submission: any) {
  expect(submission).toMatchObject({
    id: expect.any(String),
    date_created: expect.any(String),
    kind: expect.any(String),
    site_name: expect.stringMatching(/science|private|newscience/),
    kind_id: expect.any(String),
    submitted_by: {
      id: expect.any(String),
      name: expect.any(String),
    },
    links: {
      self: expect.stringMatching(/http:\/\/.*/),
      site: expect.stringMatching(/http:\/\/.*/),
      versions: expect.stringMatching(/http:\/\/.*/),
    },
    versions: expect.any(Array),
    activity: expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        activity_type: expect.any(String),
        activity_by: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
        }),
        kind: expect.any(String),
        date_created: expect.any(String),
        links: expect.any(Object),
        status: expect.stringMatching(/PUBLISHED|REJECTED|REMOVED|APPROVED|PENDING/),
        submission_id: expect.any(String),
        submission_version: {
          id: expect.any(String),
          date_created: expect.any(String),
        },
        work_version: {
          id: expect.any(String),
          date_created: expect.any(String),
        },
      }),
    ]),
  });

  submission.versions.forEach((v: any) => {
    expectSubmissionVersion(v);
  });
}

export function expectWork(workId: string, work: any) {
  expect(work).toMatchObject({
    authors: expect.arrayContaining([{ name: expect.any(String) }]),
    canonical: expect.any(Boolean),
    cdn: expect.stringContaining('https://'),
    key: expect.any(String),
    date: expect.any(String),
    date_created: expect.any(String),
    description: expect.any(String),
    id: workId,
    links: expect.objectContaining({
      self: expect.stringMatching('http[s]*://'),
      social: expect.stringMatching('http[s]*://'),
      thumbnail: expect.stringMatching('http[s]*://'),
      config: expect.stringMatching('http[s]*://'),
    }),
    title: expect.any(String),
    version_id: expect.any(String),
  });
  if (work.links.doi) expect(work.links.doi).toEqual(expect.stringMatching('https://doi.org/'));
}

export function expectWorkVersion(workVersion: any) {
  expect(workVersion).toMatchObject({
    id: expect.any(String),
    title: expect.any(String),
    authors: expect.arrayContaining([{ name: expect.any(String) }]),
    cdn: expect.stringContaining('https://'),
    // date: expect.any(String), TODO: this is not in the response
    date_created: expect.any(String),
    work_id: expect.any(String),
    description: expect.any(String),
    canonical: expect.any(Boolean),
    links: expect.objectContaining({
      config: expect.stringContaining('https://'),
      self: expect.stringContaining('http://'),
      social: expect.stringContaining('http://'),
      thumbnail: expect.stringContaining('http://'),
      work: expect.stringContaining('http://'),
    }),
  });
}

export function expectJob(
  job: any,
  {
    payload,
    results,
    status,
    messages,
  }: {
    payload?: Record<string, any>;
    results?: Record<string, any>;
    status?: JobStatus;
    messages?: string[];
  },
) {
  expect(Object.keys(job).length).toEqual(9);
  expect(job).toMatchObject({
    id: expect.any(String),
    date_created: expect.any(String),
    date_modified: expect.any(String),
    job_type: KnownJobTypes.CHECK,
    status: status ?? JobStatus.QUEUED,
    payload: expect.objectContaining(payload ?? {}),
    results: expect.objectContaining(results ?? {}),
    messages: expect.arrayContaining(messages ?? []),
    links: expect.objectContaining({
      self: expect.stringContaining('http://'),
    }),
  });
}

export async function seedJob(id: string) {
  const date = new Date().toISOString();
  await prisma.job.create({
    data: {
      id,
      date_created: date,
      date_modified: date,
      job_type: KnownJobTypes.CHECK,
      status: JobStatus.QUEUED,
      payload: { test: 'payload' },
      messages: [],
    },
  });
}

export async function deleteJob(id: string) {
  await prisma.job.delete({
    where: {
      id,
    },
  });
}

export async function createTestUser(
  role: SystemRole = SystemRole.USER,
  options: {
    pending?: boolean;
    disabled?: boolean;
    siteRoles?: { siteName: string; role: $Enums.SiteRole }[];
    roles?: string[]; // Array of role names to assign to the user
  } = {},
) {
  // Log database connection details
  console.log('Database URL:', process.env.DATABASE_URL);
  console.log('Prisma Client Config:', prisma.$connect);

  try {
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        display_name: `Test User ${role}`,
        system_role: role,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        username: 'test',
        pending: options.pending ?? false,
        disabled: options.disabled ?? false,
      },
    });

    // Create site roles if provided
    if (options.siteRoles && options.siteRoles.length > 0) {
      for (const siteRole of options.siteRoles) {
        // First, get or create the site
        let site = await prisma.site.findUnique({
          where: { name: siteRole.siteName },
        });

        if (!site) {
          site = await prisma.site.create({
            data: {
              id: `site-${siteRole.siteName}-${Date.now()}`,
              name: siteRole.siteName,
              title: `Test Site ${siteRole.siteName}`,
              date_created: new Date().toISOString(),
              date_modified: new Date().toISOString(),
              metadata: {},
            },
          });
        }

        // Create the site user relationship
        await prisma.siteUser.create({
          data: {
            id: `site-user-${user.id}-${site.id}-${Date.now()}`,
            user_id: user.id,
            site_id: site.id,
            role: siteRole.role,
            date_created: new Date().toISOString(),
            date_modified: new Date().toISOString(),
          },
        });
      }
    }

    // Assign roles if provided
    if (options.roles && options.roles.length > 0) {
      for (const roleName of options.roles) {
        // Find the role by name
        const userRole = await prisma.role.findUnique({
          where: { name: roleName },
        });

        if (userRole) {
          await prisma.userRole.create({
            data: {
              id: `test-user-role-${user.id}-${roleName}-${Date.now()}`,
              user_id: user.id,
              role_id: userRole.id,
              date_created: new Date().toISOString(),
              date_modified: new Date().toISOString(),
            },
          });
        } else {
          console.warn(`Role '${roleName}' not found, skipping assignment`);
        }
      }
    }

    // Get site roles for this user (after creating them)
    const siteRoles = await prisma.siteUser.findMany({
      where: { user_id: user.id },
      include: { site: true },
    });

    const siteRolesInfo =
      siteRoles.length > 0
        ? siteRoles.map((sr) => `${sr.site.name}:${sr.role}`).join(', ')
        : 'none';

    // Get assigned roles for this user
    const userRoles = await prisma.userRole.findMany({
      where: { user_id: user.id },
      include: { role: true },
    });

    const rolesInfo =
      userRoles.length > 0 ? userRoles.map((ur) => ur.role.name).join(', ') : 'none';

    console.log('Created test user:', {
      ...user,
      site_roles: siteRolesInfo,
      roles: rolesInfo,
    });

    // Track the user for cleanup
    testUserIds.push(user.id);
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

/**
 * Helper function to create a test user with platform admin role
 * This replaces the old SystemRole.PLATFORM_ADMIN approach
 */
export async function createTestUserWithPlatformAdminRole(
  options: {
    pending?: boolean;
    disabled?: boolean;
    siteRoles?: { siteName: string; role: $Enums.SiteRole }[];
  } = {},
) {
  return createTestUser(SystemRole.USER, {
    ...options,
    roles: ['platform-admin'],
  });
}

export async function generateTestToken(user: UserDBO) {
  const config = await loadValidatedConfig();
  const fullConfig = config.fullConfig as any;

  return createSessionToken(
    user,
    fullConfig.api.sessionTokenAudience,
    fullConfig.api.sessionTokenIssuer,
    'Test token',
    fullConfig.api.tokenConfigUrl,
    fullConfig.api.jwtSigningSecret,
  );
}

export async function cleanupTestUser(userId: string) {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });
    // Remove from tracking array
    const index = testUserIds.indexOf(userId);
    if (index > -1) {
      testUserIds.splice(index, 1);
    }
  } catch (error) {
    console.error(`Error cleaning up test user ${userId}:`, error);
  }
}

// Cleanup all test users
export async function cleanupAllTestUsers() {
  console.log('Cleaning up all test users...');
  const errors: Error[] = [];

  for (const userId of testUserIds) {
    try {
      await prisma.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      console.error(`Error cleaning up test user ${userId}:`, error);
      errors.push(error as Error);
    }
  }

  // Clear the tracking array
  testUserIds.length = 0;

  if (errors.length > 0) {
    console.error('Errors during test user cleanup:', errors);
  }
}
