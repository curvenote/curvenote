import chalk from 'chalk';
import { orcid } from 'orcid';
import type { Contributor } from 'myst-frontmatter';
import type { ISession } from '../../session/types.js';

// ============================================================================
// AUTHOR LOOKUP - Supports ORCID and GitHub
// ============================================================================

/**
 * Extract and normalize ORCID ID from a string (handles URLs like https://orcid.org/0000-0002-7859-8394)
 */
export function extractORCID(input: string): string {
  const normalized = orcid.normalize(input);
  return normalized || input.trim();
}

/**
 * Validate ORCID format (xxxx-xxxx-xxxx-xxxx)
 */
export function validateORCID(orcidStr: string): boolean {
  return orcid.validate(orcidStr);
}

/**
 * Detect if a string is an ORCID ID
 */
export function isORCID(input: string): boolean {
  const normalized = extractORCID(input);
  return validateORCID(normalized);
}

/**
 * Detect if a string is a valid GitHub username
 * GitHub usernames: 1-39 chars, alphanumeric or hyphens, cannot start/end with hyphen
 */
export function isGitHubUsername(input: string): boolean {
  const username = input.trim().replace(/^@/, ''); // Remove leading @ if present
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}

/**
 * Fetch author information from ORCID Public API
 */
export async function fetchORCIDInfo(
  session: ISession,
  orcidId: string,
): Promise<Contributor | null> {
  try {
    session.log.debug(`Fetching ORCID info for ${orcidId}`);

    const response = await session.fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      session.log.error(`ORCID API returned ${response.status} for ${orcidId}`);
      return null;
    }

    const person = (await response.json()) as any;

    const name =
      person?.name?.['credit-name']?.value ||
      `${person?.name?.['given-names']?.value || ''} ${person?.name?.['family-name']?.value || ''}`.trim();

    const emails = person?.emails?.email?.map((e: any) => e.email).filter(Boolean) || [];
    const email = emails[0] || undefined;

    // Extract affiliations
    const affiliations: string[] = [];
    const employments = person?.['activities-summary']?.employments?.['affiliation-group'] || [];
    for (const group of employments) {
      const summaries = Array.isArray(group['employment-summary'])
        ? group['employment-summary']
        : [group['employment-summary']];
      for (const emp of summaries) {
        const orgName = emp?.organization?.name;
        if (orgName && !affiliations.includes(orgName)) {
          affiliations.push(orgName);
        }
      }
    }

    if (!name) {
      session.log.warn(`Could not extract name from ORCID ${orcidId}`);
      return null;
    }

    session.log.debug(
      `ORCID ${orcidId} fetched: name=${name}, email=${email}, affiliations=${JSON.stringify(affiliations)}`,
    );

    return {
      name,
      orcid: orcidId,
      email,
      affiliations: affiliations.length > 0 ? affiliations : undefined,
      corresponding: !!email,
    };
  } catch (error) {
    session.log.error(`Failed to fetch ORCID info for ${orcidId}: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Extract social accounts and ORCID from GitHub profile
 */
async function getSocialAccountsFromGitHub(
  session: ISession,
  username: string,
): Promise<{
  bluesky?: string;
  linkedin?: string;
  twitter?: string;
}> {
  const socialAccounts: { bluesky?: string; linkedin?: string; twitter?: string } = {};

  try {
    // Try the social_accounts API
    const socialResponse = await session.fetch(
      `https://api.github.com/users/${username}/social_accounts`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (socialResponse.ok) {
      const accounts = (await socialResponse.json()) as Array<{
        provider: string;
        url: string;
      }>;

      for (const account of accounts) {
        if (account.provider === 'bluesky' && account.url) {
          // Extract handle from URL like https://bsky.app/profile/row1.ca
          const match = account.url.match(/profile\/([^/]+)/);
          if (match) {
            socialAccounts.bluesky = `@${match[1]}`;
          }
        } else if (account.provider === 'linkedin' && account.url) {
          socialAccounts.linkedin = account.url;
        } else if (account.provider === 'twitter' && account.url) {
          // Extract username from URL
          const match = account.url.match(/twitter\.com\/([^/]+)/);
          if (match) {
            socialAccounts.twitter = match[1];
          }
        }
      }
    }

    // Fallback: scrape the GitHub profile page for additional info
    const profileResponse = await session.fetch(`https://github.com/${username}`);
    if (profileResponse.ok) {
      const html = await profileResponse.text();

      // Try to extract Bluesky if not found in API
      if (!socialAccounts.bluesky) {
        const blueskyMatch = html.match(/Bluesky\s+@([^\s<]+)/);
        if (blueskyMatch) {
          socialAccounts.bluesky = `@${blueskyMatch[1]}`;
        }
      }

      // Try to extract LinkedIn if not found in API
      if (!socialAccounts.linkedin) {
        const linkedinMatch = html.match(/LinkedIn\s+(in\/[^\s<]+)/);
        if (linkedinMatch) {
          socialAccounts.linkedin = `https://www.linkedin.com/${linkedinMatch[1]}`;
        }
      }
    }
  } catch (error) {
    session.log.debug(`Failed to extract social accounts from GitHub: ${(error as Error).message}`);
  }

  return socialAccounts;
}

/**
 * Try to extract ORCID from GitHub profile via social_accounts API and profile scraping
 */
async function getORCIDFromGitHub(session: ISession, username: string): Promise<string | null> {
  try {
    // Scrape the GitHub profile page for ORCID
    const profileResponse = await session.fetch(`https://github.com/${username}`);
    if (profileResponse.ok) {
      const html = await profileResponse.text();
      const orcidMatch = html.match(/href="(https:\/\/orcid\.org\/[0-9X-]+)"/);
      if (orcidMatch) {
        const match = orcidMatch[1].match(/orcid\.org\/([0-9X-]+)/);
        if (match) {
          session.log.debug(`Found ORCID ${match[1]} in GitHub profile HTML`);
          return match[1];
        }
      }
    }
  } catch (error) {
    session.log.debug(`Failed to extract ORCID from GitHub: ${(error as Error).message}`);
  }

  return null;
}

/**
 * Fetch author information from GitHub API and profile page
 */
export async function fetchGitHubInfo(
  session: ISession,
  username: string,
): Promise<Contributor | null> {
  try {
    const cleanUsername = username.trim().replace(/^@/, '');
    session.log.debug(`Fetching GitHub info for ${cleanUsername}`);

    const response = await session.fetch(`https://api.github.com/users/${cleanUsername}`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      session.log.error(`GitHub API returned ${response.status} for ${cleanUsername}`);
      return null;
    }

    const user = (await response.json()) as any;

    // Extract basic info from API
    const name = user.name || user.login;
    const email = user.email || undefined;
    // Store just the username, not the full URL (per MyST validation rules)
    const github = cleanUsername;
    const website = user.blog || undefined;

    // Extract company as potential affiliation
    let affiliations: string[] | undefined;
    if (user.company) {
      // Clean up company name (remove @ prefix if present)
      const company = user.company.replace(/^@/, '').trim();
      if (company) {
        affiliations = [company];
      }
    }

    session.log.debug(
      `GitHub ${cleanUsername} fetched: name=${name}, email=${email}, username=${github}`,
    );

    // Try to get ORCID and social accounts
    const orcidId = await getORCIDFromGitHub(session, cleanUsername);
    const socialAccounts = await getSocialAccountsFromGitHub(session, cleanUsername);

    let contributor: Contributor = {
      name,
      email,
      github,
      corresponding: !!email,
      affiliations,
    };

    // Add website/blog if available
    if (website) {
      contributor.url = website.startsWith('http') ? website : `https://${website}`;
    }

    // Add social accounts
    if (socialAccounts.twitter) {
      contributor.twitter = socialAccounts.twitter;
    }
    if (socialAccounts.bluesky) {
      contributor.bluesky = socialAccounts.bluesky;
    }
    if (socialAccounts.linkedin) {
      contributor.linkedin = socialAccounts.linkedin;
    }

    // If we found an ORCID on GitHub, fetch full ORCID data
    if (orcidId) {
      session.log.info(
        chalk.dim(`  Found ORCID ${chalk.cyan(orcidId)} on GitHub profile for ${cleanUsername}`),
      );
      contributor.orcid = orcidId;

      const orcidData = await fetchORCIDInfo(session, orcidId);
      if (orcidData) {
        // Merge GitHub and ORCID data
        // Prefer ORCID name and affiliations if available, but keep GitHub social data
        contributor = {
          ...contributor,
          ...orcidData,
          // Keep GitHub-specific data even if ORCID data is present
          github,
          url: contributor.url || orcidData.url,
          twitter: contributor.twitter || orcidData.twitter,
          bluesky: contributor.bluesky || orcidData.bluesky,
          linkedin: contributor.linkedin || orcidData.linkedin,
          // Prefer ORCID affiliations if available, otherwise use GitHub company
          affiliations: orcidData.affiliations || contributor.affiliations,
          // Prefer email from whichever source has it
          email: orcidData.email || email,
        };
      }
    }

    return contributor;
  } catch (error) {
    session.log.error(`Failed to fetch GitHub info for ${username}: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Unified author lookup: automatically detects if input is ORCID or GitHub username
 * and fetches the appropriate data
 */
export async function lookupAuthor(
  session: ISession,
  identifier: string,
): Promise<Contributor | null> {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return null;
  }

  // Check if it's an ORCID
  if (isORCID(trimmed)) {
    const orcidId = extractORCID(trimmed);
    session.log.info(chalk.dim(`  Looking up ORCID: ${chalk.cyan(orcidId)}`));
    return await fetchORCIDInfo(session, orcidId);
  }

  // Check if it's a GitHub username
  if (isGitHubUsername(trimmed)) {
    const username = trimmed.replace(/^@/, '');
    session.log.info(chalk.dim(`  Looking up GitHub user: ${chalk.cyan(username)}`));
    return await fetchGitHubInfo(session, username);
  }

  // Not recognized as either format
  session.log.warn(`"${trimmed}" is not recognized as an ORCID ID or GitHub username. Skipping.`);
  return null;
}
