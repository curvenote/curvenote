import { formatDate } from '@curvenote/scms-core';

/** Earliest publication year offered in publication-date calendar dropdowns. */
export const PUBLICATION_DATE_CALENDAR_FROM_YEAR = 1990;

const PUBLICATION_DATE_DISPLAY_FORMAT = 'd MMMM yyyy';

/** Formats a publication date for the summary card and listing. */
export function formatPublicationDate(date: string): string {
  return formatDate(date, PUBLICATION_DATE_DISPLAY_FORMAT);
}

/** Local calendar midnight — avoids timezone/`toISOString` day shifts in matchers. */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Calendar props for picking a publication date: year dropdown span plus no
 * future days (publication dates cannot be after today).
 */
export function publicationDateCalendarBounds(now: Date = new Date()) {
  const today = startOfLocalDay(now);
  return {
    fromDate: new Date(PUBLICATION_DATE_CALENDAR_FROM_YEAR, 0, 1),
    fromYear: PUBLICATION_DATE_CALENDAR_FROM_YEAR,
    toYear: now.getFullYear(),
    toDate: today,
    disabled: { after: today },
  };
}
