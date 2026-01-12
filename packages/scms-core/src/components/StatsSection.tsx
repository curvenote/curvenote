import { Card } from './primitives/Card.js';
import { Badge } from './ui/badge.js';

export type StatCardData = {
  type: 'count' | 'date' | 'status';
  label: string;
  value: string | number;
  variant?: 'default' | 'secondary';
  colorClass?: string;
};

interface StatsSectionProps {
  stats: StatCardData[];
  actionButton?: React.ReactNode;
}

export function StatsSection({ stats, actionButton }: StatsSectionProps) {
  function renderStatCard(stat: StatCardData) {
    switch (stat.type) {
      case 'count':
        return (
          <Card className="p-4" key={stat.label}>
            <div className={`text-2xl font-bold ${stat.colorClass || 'text-blue-600'}`}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </Card>
        );

      case 'date':
        return (
          <Card className="p-4" key={stat.label}>
            <div className="text-sm font-medium text-gray-600">{stat.label}</div>
            <div className="text-sm">{stat.value}</div>
          </Card>
        );

      case 'status':
        return (
          <Card className="p-4" key={stat.label}>
            <div className="text-sm font-medium text-gray-600">{stat.label}</div>
            <div className="flex items-center gap-2">
              <Badge variant={stat.variant || 'default'}>{stat.value}</Badge>
            </div>
          </Card>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
      <div
        className={`grid flex-1 gap-4 ${
          stats.length === 1
            ? 'grid-cols-1'
            : stats.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : stats.length === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {stats.map(renderStatCard)}
      </div>
      {actionButton && actionButton}
    </div>
  );
}
