import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';

export type CronSchedulePreview =
  | { valid: true; description: string }
  | { valid: false; error: string };

/** Live client preview — uses the same parser as server-side schedule validation. */
export function previewCronSchedule(
  schedule: string,
  timezone = 'UTC',
): CronSchedulePreview | null {
  const trimmed = schedule.trim();
  if (!trimmed) {
    return null;
  }

  try {
    CronExpressionParser.parse(trimmed, { tz: timezone });
  } catch {
    return { valid: false, error: 'Invalid cron schedule expression' };
  }

  try {
    return {
      valid: true,
      description: cronstrue.toString(trimmed, { use24HourTimeFormat: true }),
    };
  } catch {
    return { valid: true, description: 'Valid schedule' };
  }
}
