import { format, formatDistanceToNow } from 'date-fns';

export function formatToNow(date: string, { addSuffix = false } = {}) {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    console.warn(`Invalid date string: ${date}`);
    return '';
  }
  return formatDistanceToNow(dateObj, { addSuffix });
}

export function formatDatetime(str: string, fmt = 'MMM dd, y HH:mm:ss') {
  if (!str || str.trim() === '') {
    return '';
  }

  const date = new Date(str);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid datetime string: ${str}`);
    return '';
  }

  return format(date, fmt);
}

/**
 * Format a date string to a readable date string.
 *
 * This function will separately handle ISO conformant dates
 * including malformed dates like "2025-8-1" before falling back to
 * the default date-fns format function.
 *
 * @param str - The date string to format.
 * @param fmt - The format to use.
 * @returns The formatted date string.
 */
export function formatDate(str: string, fmt = 'MMM dd, y') {
  if (!str || str.trim() === '') {
    return '';
  }

  if (str.match(/^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/)) {
    const parts = str.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    // Validate date parts
    if (year < 1000 || year > 9999 || month < 0 || month > 11 || day < 1 || day > 31) {
      console.warn(`Invalid date parts: year=${year}, month=${month + 1}, day=${day}`);
      return '';
    }

    const date = new Date(year, month, day);

    // Check if the date is valid
    if (
      isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      console.warn(`Invalid date constructed from: ${str}`);
      return '';
    }

    return format(date, fmt);
  }

  const date = new Date(str);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${str}`);
    return '';
  }

  return format(date, fmt);
}

export function formatTime(str: string, fmt = 'HH:mm:ss') {
  if (!str || str.trim() === '') {
    return '';
  }

  const date = new Date(str);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid time string: ${str}`);
    return '';
  }

  return format(date, fmt);
}

/**
 * Ensure that the date is in ISO format.
 *
 * This is a workaround for the fact that some dates are in the format
 * "2025-08-27" and some are in the format "2025-8-27".
 *
 * This function will convert the date to the ISO format.
 *
 * @param str - The date string to ensure is in ISO format.
 * @returns The date string in ISO format.
 */
export function ensureISODate(str: string) {
  if (str.match(/^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/)) {
    if (str.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
      return str;
    }
    const year = Number(str.split('-')[0]);
    const month = Number(str.split('-')[1]) - 1;
    const day = Number(str.split('-')[2]);
    return format(new Date(year, month, day), 'yyyy-MM-dd');
  }
  return str;
}
