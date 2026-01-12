// Utility to summarize authors for display throughout the app
// Supports various author object shapes and formatting options

type Author = {
  family?: string;
  given?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  surname?: string;
};

interface SummarizeAuthorsOptions {
  maxDisplay?: number;
  display?: 'surname' | 'initials' | 'full';
}

function extractNames(author: Author): { surname: string; given: string } {
  // Try all possible fields for surname
  let surname = author.family || author.lastName || author.surname || '';
  let given = author.given || author.firstName || '';

  // If name field exists, try to parse it
  if ((!surname || !given) && author.name) {
    // Try to handle 'Last, First' or 'First Last'
    const name = author.name.trim();
    if (name.includes(',')) {
      // 'Last, First Middle'
      const [last, rest] = name.split(',', 2);
      surname = surname || last.trim();
      given = given || rest?.trim() || '';
    } else {
      // 'First Middle Last' (assume last word is surname)
      const parts = name.split(' ');
      if (parts.length > 1) {
        surname = surname || parts[parts.length - 1];
        given = given || parts.slice(0, -1).join(' ');
      } else {
        surname = surname || name;
      }
    }
  }

  // Fallbacks
  if (!surname && !given) {
    return { surname: 'Unknown', given: '' };
  }
  if (!surname) {
    return { surname: 'Unknown', given };
  }
  return { surname, given };
}

function formatAuthor(
  author: Author,
  display: 'surname' | 'initials' | 'full' = 'surname',
): string {
  const { surname, given } = extractNames(author);
  if (surname === 'Unknown') return 'Unknown';
  if (display === 'surname') return surname;
  if (display === 'full') return given ? `${surname}, ${given}` : surname;
  if (display === 'initials') {
    if (!given) return surname;
    // Get all initials from given names
    const initials = given
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0]?.toUpperCase() + '.')
      .join(' ');
    return `${surname}, ${initials}`;
  }
  return surname;
}

export function summarizeAuthors(authors: Author[], options?: SummarizeAuthorsOptions): string {
  const maxDisplay = options?.maxDisplay ?? 2;
  const display = options?.display ?? 'surname';
  if (!Array.isArray(authors) || authors.length === 0) return '';

  const formatted = authors.map((a) => formatAuthor(a, display));
  if (authors.length <= maxDisplay) {
    return formatted.join(', ');
  }
  const shown = formatted.slice(0, maxDisplay).join(', ');
  const more = authors.length - maxDisplay;
  return `${shown}, +${more} more authors`;
}
