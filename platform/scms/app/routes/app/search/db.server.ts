import { getPrismaClient } from '@curvenote/scms-server';
import Fuse from 'fuse.js';

/**
 * Search users using hybrid database + Fuse.js approach for optimal fuzzy matching
 * 1. Pre-filters candidates using database ILIKE for performance
 * 2. Uses Fuse.js for sophisticated fuzzy ranking and typo tolerance
 * Searches over display_name, username, and email fields with partial matching
 * Excludes: disabled accounts, users without email, and SERVICE system role accounts
 */
export async function dbSearchUsers(
  query: string,
  limit: number = 20,
): Promise<
  Array<{
    id: string;
    display_name: string | null;
    username: string | null;
    email: string;
    date_created: string;
  }>
> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const prisma = await getPrismaClient();
  const searchQuery = query.trim();

  // Step 1: Database pre-filtering to get candidates
  // This leverages database indexes for fast initial filtering
  const candidates = await prisma.user.findMany({
    where: {
      AND: [
        { disabled: false },
        { email: { not: null } },
        { system_role: { not: 'SERVICE' } }, // Exclude service accounts
        {
          OR: [
            { display_name: { contains: searchQuery, mode: 'insensitive' } },
            { username: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: {
      id: true,
      display_name: true,
      username: true,
      email: true,
      date_created: true,
    },
    take: limit * 3, // Get more candidates for Fuse.js refinement
  });

  if (candidates.length === 0) {
    return [];
  }

  // Filter out users without emails (for type safety)
  const usersWithEmails = candidates.filter((user) => user.email);

  // Step 2: Fuse.js for sophisticated fuzzy ranking
  const fuseOptions = {
    keys: [
      { name: 'display_name', weight: 0.4 },
      { name: 'username', weight: 0.3 },
      { name: 'email', weight: 0.3 },
    ],
    threshold: 0.4, // More permissive for better partial matching
    includeScore: true,
    shouldSort: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
    findAllMatches: true,
    isCaseSensitive: false,
  };

  const fuse = new Fuse(usersWithEmails, fuseOptions);
  const results = fuse.search(searchQuery);

  // Return top results ranked by Fuse.js relevance
  return results.slice(0, limit).map((result) => ({
    id: result.item.id,
    display_name: result.item.display_name,
    username: result.item.username,
    email: result.item.email!,
    date_created: result.item.date_created,
  }));
}
