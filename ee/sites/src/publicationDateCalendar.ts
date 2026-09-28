import { formatDate, utcDayFromDate } from '@curvenote/scms-core';

/** Earliest publication year offered in publication-date calendar dropdowns. */
export const PUBLICATION_DATE_CALENDAR_FROM_YEAR = 1990;

const PUBLICATION_DATE_DISPLAY_FORMAT = 'd MMMM yyyy';

const CALENDAR_DAY = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/;

function depositedDay(date: string): string {
  if (CALENDAR_DAY.test(date)) {
    return date;
  }
  const instant = new Date(date);
  return Number.isNaN(instant.getTime()) ? date : utcDayFromDate(instant);
}

/**
 * Formats a publication date for the summary card, listing and DOI dialog. A timestamp shows
 * its UTC day, the day a DOI deposit sends to Crossref, whatever the viewer's timezone.
 */
export function formatPublicationDate(date: string): string {
  return formatDate(depositedDay(date), PUBLICATION_DATE_DISPLAY_FORMAT);
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
