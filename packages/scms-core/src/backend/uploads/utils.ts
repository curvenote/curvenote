/**
 * Generates a sanitized label from a filename
 * @param filename - The original filename
 * @returns A sanitized label (no extension, keeps spaces, underscores and hyphens, max 100 chars)
 */
export function generateFileLabel(filename: string): string {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

  // Remove special characters, keep alphanumeric, spaces, hyphens, and underscores
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9 _-]/g, '') // Keep only alphanumeric, spaces, underscores, and hyphens
    .substring(0, 100); // Limit to 100 characters

  return sanitized || 'untitled'; // Fallback if empty
}

/**
 * Generates a unique label from a filename, ensuring it doesn't conflict with existing labels
 * @param filename - The original filename
 * @param existingLabels - Set of existing labels to check against
 * @returns A unique sanitized label
 */
export function generateUniqueFileLabel(filename: string, existingLabels: Set<string>): string {
  const baseLabel = generateFileLabel(filename);
  let uniqueLabel = baseLabel;
  let counter = 1;

  // Keep adding numbers until we find a unique label
  while (existingLabels.has(uniqueLabel)) {
    // Truncate base label to make room for counter
    const maxBaseLength = 95; // Leave room for counter (max 4 digits + 1)
    const truncatedBase = baseLabel.substring(0, maxBaseLength);
    uniqueLabel = `${truncatedBase}${counter}`;
    counter++;

    // Prevent infinite loop (shouldn't happen with reasonable limits)
    if (counter > 9999) {
      uniqueLabel = `file${Date.now()}`;
      break;
    }
  }

  return uniqueLabel;
}
