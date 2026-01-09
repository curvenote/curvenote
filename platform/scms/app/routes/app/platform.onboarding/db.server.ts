import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';

/**
 * Validate that username, email, and ORCID ID are not already in use
 */
export async function validateUserUniqueness({
  username,
  email,
  orcidId,
}: {
  username: string;
  email: string;
  orcidId: string;
}) {
  const prisma = await getPrismaClient();

  // Check for duplicate username
  const existingUsername = await prisma.user.findFirst({
    where: { username },
    select: { id: true, username: true },
  });

  if (existingUsername) {
    return { error: `Username "${username}" is already in use` };
  }

  // Check for duplicate email
  const existingEmail = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });

  if (existingEmail) {
    return { error: `Email "${email}" is already in use` };
  }

  // Check for duplicate ORCID ID
  const existingOrcid = await prisma.userLinkedAccount.findFirst({
    where: {
      provider: 'orcid',
      idAtProvider: orcidId,
    },
    select: { id: true, idAtProvider: true },
  });

  if (existingOrcid) {
    return { error: `ORCID ID "${orcidId}" is already linked to another user` };
  }

  // All validations passed
  return { valid: true };
}

/**
 * Create a new user with ORCID linked account for platform admin purposes
 */
export async function dbCreateUserWithOrcidAccount({
  username,
  email,
  displayName,
  orcidId,
}: {
  username: string;
  email: string;
  displayName: string;
  orcidId: string;
}) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  const userId = uuidv7();

  // Create ORCID profile in the format expected by the system
  const orcidProfile = {
    id: orcidId,
    name: displayName,
    email: email,
    emails: [
      {
        path: null,
        email: email,
        source: {
          'source-name': { value: displayName },
          'source-orcid': {
            uri: `https://orcid.org/${orcidId}`,
            host: 'orcid.org',
            path: orcidId,
          },
          'source-client-id': null,
          'assertion-origin-name': null,
          'assertion-origin-orcid': null,
          'assertion-origin-client-id': null,
        },
        primary: true,
        'put-code': null,
        verified: true,
        visibility: 'public',
        'created-date': { value: Date.now() },
        'last-modified-date': { value: Date.now() },
      },
    ],
    emailVerified: true,
  };

  return prisma.user.create({
    data: {
      id: userId,
      date_created: timestamp,
      date_modified: timestamp,
      email,
      username,
      display_name: displayName,
      system_role: 'USER',
      primaryProvider: 'orcid',
      pending: false,
      ready_for_approval: false,
      data: {
        signup: {
          completedAt: timestamp,
          status: 'completed',
          skipReason: 'platform_admin',
        },
      },
      linkedAccounts: {
        create: [
          {
            id: uuidv7(),
            date_created: timestamp,
            date_modified: timestamp,
            date_linked: timestamp,
            provider: 'orcid',
            idAtProvider: orcidId,
            email: email,
            profile: orcidProfile,
            pending: false,
          },
        ],
      },
    },
    include: {
      linkedAccounts: true,
      site_roles: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      },
    },
  });
}
