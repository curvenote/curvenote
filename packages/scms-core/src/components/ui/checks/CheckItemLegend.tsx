/** Labels for each legend column; omitted keys use generic defaults. */
export type CheckItemLegendLabels = {
  total?: string;
  green?: string;
  amber?: string;
  red?: string;
};

export interface CheckItemLegendProps {
  total: number;
  red: number;
  amber: number;
  green: number;
  labels?: CheckItemLegendLabels;
}

export function CheckItemLegend({ total, red, amber, green, labels }: CheckItemLegendProps) {
  const stats = [
    {
      value: total,
      label: labels?.total ?? 'Total',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-600',
    },
    {
      value: green,
      label: labels?.green ?? 'No issues',
      textColor: 'text-[#1B8364]',
      borderColor: 'border-[#1B8364]',
    },
    {
      value: amber,
      label: labels?.amber ?? 'Pending review',
      textColor: 'text-yellow-600',
      borderColor: 'border-yellow-600',
    },
    {
      value: red,
      label: labels?.red ?? 'Flagged',
      textColor: 'text-[#9B1E1E]',
      borderColor: 'border-[#9B1E1E]',
    },
  ];

  return (
    <div className="flex flex-wrap">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex-1 min-w-[140px] px-4 py-6 border-l-2 ${stat.borderColor}`}
        >
          <div className={`text-5xl font-light ${stat.textColor}`}>{stat.value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
