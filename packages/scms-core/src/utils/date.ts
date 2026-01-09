/**
 * Converts a Date object to a YYYY-MM-DD string format
 */
export function hyphenatedFromDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD string to a Date object
 */
export function hyphenatedToDate(date: string): Date {
  if (!date.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
    return new Date(date);
  }
  const year = Number(date.split('-')[0]);
  const month = Number(date.split('-')[1]) - 1;
  const day = Number(date.split('-')[2]);
  return new Date(year, month, day);
}
