/** Labels for each legend column; omitted keys use generic defaults. */
export type CheckItemLegendLabels = {
  total?: string;
  green?: string;
  amber?: string;
  red?: string;
};

export interface CheckItemLegendProps {
  stats: {
    value: number;
    label: string;
    textColor: string;
    borderColor: string;
  }[];
}

/**
 * Horizontal legend for check summaries: each column shows a large `value`, a muted `label`, and a
 * left border tinted with `borderColor` while the number uses `textColor`. Both must be Tailwind
 * class strings so callers can align with punchcards, badges, and theme (including `dark:*`
 * variants where needed).
 *
 * @example Illustrative `stats` array — replace values/labels with real check data from your extension:
 * ```tsx
 * const stats = [
 *   { value: 10, label: 'Total', textColor: 'text-blue-600', borderColor: 'border-blue-600' },
 *   { value: 1, label: 'No issues', textColor: 'text-[#1B8364]', borderColor: 'border-[#1B8364]' },
 *   { value: 3, label: 'Pending review', textColor: 'text-yellow-600', borderColor: 'border-yellow-600' },
 *   { value: 1, label: 'Flagged', textColor: 'text-[#9B1E1E]', borderColor: 'border-[#9B1E1E]' },
 * ];
 * return <CheckItemLegend stats={stats} />;
 * ```
 */
export function CheckItemLegend({ stats }: CheckItemLegendProps) {
  if (stats.length === 0) return null;
  return (
    <div className="flex flex-wrap">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex-1 min-w-[140px] max-w-[240px] px-4 py-6 border-l-2 ${stat.borderColor}`}
        >
          <div className={`text-5xl font-light ${stat.textColor}`}>{stat.value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
