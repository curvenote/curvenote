import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadProjectFromDisk, selectors, writeConfigs } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import type { Contributor } from 'myst-frontmatter';
import { orcid } from 'orcid';
import type { ISession } from '../../session/types.js';

// ============================================================================
// PROJECT MODIFICATION HANDLERS
// These functions operate on EXISTING projects (require projectConfig)
// Add new project modification operations here
// ============================================================================

/**
 * Helper to validate that a project config exists
 * Used by project modification operations
 */
export function validateExistingProject(session: ISession, currentPath: string): ProjectConfig {
  const projectConfig = selectors.selectCurrentProjectConfig(session.store.getState());
  if (!projectConfig) {
    throw Error(
      `No project config found at ${currentPath}. Run ${chalk.bold('curvenote init')} first.`,
    );
  }
  return projectConfig;
}

/**
 * Handle --write-toc option: Generate table of contents for existing project
 */
export async function handleWriteTOC(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  if (projectConfig.toc) {
    session.log.warn('Not writing the table of contents, it already exists!');
    return;
  }
  await loadProjectFromDisk(session, currentPath, { writeTOC: true });
}

// ============================================================================
// AUTHOR MANAGEMENT HELPERS
// ============================================================================

/**
 * Extract and normalize ORCID ID from a string (handles URLs like https://orcid.org/0000-0002-7859-8394)
 */
function extractORCID(input: string): string {
  const normalized = orcid.normalize(input);
  return normalized || input.trim();
}

/**
 * Validate ORCID format (xxxx-xxxx-xxxx-xxxx)
 */
function validateORCID(orcidStr: string): boolean {
  return orcid.validate(orcidStr);
}

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Fetch author information from ORCID Public API
 */
async function fetchORCIDInfo(session: ISession, orcidId: string): Promise<Contributor | null> {
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
 * Parse author string: "Name; Affiliation; Email"
 * Affiliation can be "null" to skip
 */
function parseAuthorString(authorStr: string): Partial<Contributor> {
  const parts = authorStr.split(';').map((p) => p.trim());
  const name = parts[0];
  const affiliation = parts[1] && parts[1].toLowerCase() !== 'null' ? parts[1] : undefined;
  const email = parts[2] || undefined;

  return {
    name,
    affiliations: affiliation ? [affiliation] : undefined,
    email,
    corresponding: !!email,
  };
}

/**
 * Match or add affiliations to the project
 */
function matchOrAddAffiliations(
  projectConfig: ProjectConfig,
  author: Partial<Contributor>,
): string[] | undefined {
  if (!author.affiliations || author.affiliations.length === 0) {
    return undefined;
  }

  // For now, just return the affiliations as-is
  // MyST stores affiliations as strings in the authors array
  return author.affiliations;
}

/**
 * Interactive prompt for adding an author
 */
async function promptForAuthor(session: ISession): Promise<Contributor | null> {
  const orcidPrompt = await inquirer.prompt([
    {
      name: 'orcid',
      message: 'Enter ORCID or ORCID URL (or leave blank to enter manually):',
      type: 'input',
      validate: (input: string) => {
        if (!input) return true;
        const extracted = extractORCID(input);
        return validateORCID(extracted) || 'Invalid ORCID format (should be xxxx-xxxx-xxxx-xxxx)';
      },
    },
  ]);

  if (orcidPrompt.orcid) {
    const extractedORCID = extractORCID(orcidPrompt.orcid);
    const author = await fetchORCIDInfo(session, extractedORCID);
    if (author) {
      session.log.info(`\n${chalk.bold('Found author information:')}`);
      session.log.info(`  Name: ${author.name}`);
      if (author.email) session.log.info(`  Email: ${author.email}`);
      if (author.affiliations?.length) {
        session.log.info(`  Affiliations: ${author.affiliations.join(', ')}`);
      }

      const confirm = await inquirer.prompt([
        {
          name: 'confirm',
          message: 'Add this author?',
          type: 'confirm',
          default: true,
        },
      ]);

      if (confirm.confirm) {
        return author as Contributor;
      }
    }
  }

  // Manual entry
  const manualPrompt = await inquirer.prompt([
    {
      name: 'name',
      message: 'Author name:',
      type: 'input',
      validate: (input: string) => !!input.trim() || 'Name is required',
    },
    {
      name: 'affiliation',
      message: 'Affiliation (optional):',
      type: 'input',
    },
    {
      name: 'email',
      message: 'Email (optional):',
      type: 'input',
      validate: (input: string) => {
        if (!input) return true;
        return validateEmail(input) || 'Invalid email format';
      },
    },
  ]);

  return {
    name: manualPrompt.name,
    affiliations: manualPrompt.affiliation ? [manualPrompt.affiliation] : undefined,
    email: manualPrompt.email || undefined,
    corresponding: !!manualPrompt.email,
  };
}

/**
 * Handle --add-authors option: Add authors to existing project
 */
export async function handleAddAuthors(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
  authorsInput?: string,
): Promise<void> {
  const newAuthors: Contributor[] = [];

  if (!authorsInput || authorsInput === 'true') {
    // Pattern 1: Interactive flow
    session.log.info(chalk.bold('\n📝 Adding authors interactively...\n'));

    let addMore = true;
    while (addMore) {
      const author = await promptForAuthor(session);
      if (author) {
        newAuthors.push(author as Contributor);
      }

      const continuePrompt = await inquirer.prompt([
        {
          name: 'addMore',
          message: 'Add another author?',
          type: 'confirm',
          default: false,
        },
      ]);
      addMore = continuePrompt.addMore;
    }
  } else {
    // Check if this is pattern 2 (ORCIDs) or pattern 3 (name-based)
    const entries = authorsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const entry of entries) {
      // Extract ORCID from potential URL
      const extractedORCID = extractORCID(entry);

      // Check if it looks like an ORCID (all digits and dashes except last char)
      if (validateORCID(extractedORCID)) {
        // Pattern 2: ORCID lookup
        const author = await fetchORCIDInfo(session, extractedORCID);
        if (author) {
          newAuthors.push(author as Contributor);
        } else {
          session.log.error(`Skipping ORCID ${extractedORCID} due to lookup failure`);
        }
      } else {
        // Pattern 3: Parse name-based entry
        const author = parseAuthorString(entry);
        if (author.name) {
          newAuthors.push(author as Contributor);
        }
      }
    }
  }

  if (newAuthors.length === 0) {
    session.log.warn('No authors were added');
    return;
  }

  // Process affiliations for all new authors
  newAuthors.forEach((author) => {
    session.log.debug(
      `Processing author ${author.name}: affiliations=${JSON.stringify(author.affiliations)}`,
    );
    if (author.affiliations) {
      author.affiliations = matchOrAddAffiliations(projectConfig, author);
      session.log.debug(
        `After matchOrAddAffiliations: affiliations=${JSON.stringify(author.affiliations)}`,
      );
    }
  });

  // Append to existing authors
  const existingAuthors = (projectConfig.authors as Contributor[]) || [];

  // Generate unique IDs for new authors to avoid collisions
  // Find the highest existing UID number
  const existingIds = existingAuthors
    .map((a) => a.id)
    .filter((id): id is string => !!id)
    .map((id) => {
      const match = id.match(/contributors-curvenote-generated-uid-(\d+)/);
      return match ? parseInt(match[1], 10) : -1;
    });
  let nextUid = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;

  // Assign IDs to new authors
  newAuthors.forEach((author) => {
    if (!author.id) {
      author.id = `contributors-curvenote-generated-uid-${nextUid++}`;
    }
  });

  const updatedAuthors = [...existingAuthors, ...newAuthors];
  session.log.debug(`Final authors before write: ${JSON.stringify(updatedAuthors, null, 2)}`);

  // Update project config
  const updatedProjectConfig: ProjectConfig = {
    ...projectConfig,
    authors: updatedAuthors,
  };

  await writeConfigs(session, currentPath, { projectConfig: updatedProjectConfig });

  session.log.info(
    chalk.green(
      `\n✅ Added ${newAuthors.length} author${newAuthors.length > 1 ? 's' : ''} to project config`,
    ),
  );
  newAuthors.forEach((author, idx) => {
    session.log.info(`  ${idx + 1}. ${author.name}${author.orcid ? ` (${author.orcid})` : ''}`);
  });
}

// Add more project modification handlers here, following the same pattern:
// - export async function handleSomeOption(session, currentPath, projectConfig)
// - Validate preconditions (e.g., check if already exists)
// - Perform the operation
// - Log appropriately
