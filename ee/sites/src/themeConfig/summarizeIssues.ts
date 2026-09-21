/** Keep the message readable when several things are wrong at once. */
export function summarizeIssues(issues: string[]): string | undefined {
  if (issues.length === 0) return undefined;
  if (issues.length <= 3) return `${issues.join('; ')}.`;
  return `${issues.slice(0, 3).join('; ')}, and ${issues.length - 3} more.`;
}
