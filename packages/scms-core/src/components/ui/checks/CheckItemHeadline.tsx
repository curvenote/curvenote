import { plural } from '../../../utils/plural.js';

export interface CheckItemHeadlineProps {
  /** Total number of images. */
  total: number;
  /** Images with issues / failures (red bucket). */
  red: number;
  /** Images awaiting review or processing (amber bucket). */
  amber: number;
  /** Images with no issues (green bucket). */
  green: number;
  /**
   * Noun fragment for `plural()` count phrases, e.g. `figure(s)` → "1 figure", "2 figures".
   * @default 'figure(s)'
   */
  countedItemPlural?: string;
}

export function CheckItemHeadline({
  total,
  red,
  amber,
  green,
  countedItemPlural = 'figure(s)',
}: CheckItemHeadlineProps) {
  const isAllClear = red === 0 && amber === 0;
  const hasOnlyConfirmedProblems = red > 0 && amber === 0;

  if (isAllClear) {
    return (
      <div className="space-y-1">
        <div className="text-3xl font-medium text-[#1B8364]">All Clear</div>
        <div className="text-base font-bold">
          {plural(`No issues flagged with %s ${countedItemPlural}`, total, { 0: 'your' })}
        </div>
      </div>
    );
  }

  if (hasOnlyConfirmedProblems) {
    return (
      <div className="space-y-1">
        <div className="text-3xl font-medium text-[#9B1E1E]">{plural('%s Problem(s)', red)}</div>
        <div className="text-base font-bold">
          {plural(`%s ${countedItemPlural}`, red)} were confirmed as problematic
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-3xl font-medium text-gray-900 dark:text-gray-100">
        {red + amber}
        <span className="font-extralight text-gray-500">/{total}</span>
      </div>
      <div className="text-base font-bold">
        {red > 0 && amber > 0 && (
          <>
            {plural(`%s ${countedItemPlural}`, red)} marked problematic, {amber}{' '}
            {green > 0 ? 'still ' : ''}
            waiting on review
          </>
        )}
        {red === 0 && amber > 0 && (
          <>
            {plural(`%s ${countedItemPlural}`, amber)} {plural('(is|are)', amber)}{' '}
            {green > 0 ? 'still ' : ''}
            waiting on review
          </>
        )}
        {red > 0 && amber === 0 && <>{plural(`%s ${countedItemPlural}`, red)} marked problematic</>}
      </div>
    </div>
  );
}
