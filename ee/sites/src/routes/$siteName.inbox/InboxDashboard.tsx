import { useSearchParams } from 'react-router';
import type { InboxActivityPage, InboxHeadlineStats } from './db.server.js';
import { InboxActivityFeed } from './InboxActivityFeed.js';
import { InboxHeadlineCards } from './InboxHeadlineCards.js';
import { INBOX_PERIOD_DEFAULT, parseInboxPeriod, type InboxPeriod } from './inboxParams.js';

interface InboxDashboardProps {
  siteName: string;
  headlineStats: InboxHeadlineStats;
  activityPage: InboxActivityPage;
}

export function InboxDashboard({ siteName, headlineStats, activityPage }: InboxDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parseInboxPeriod(searchParams.get('period'));

  const setPeriod = (next: InboxPeriod) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === INBOX_PERIOD_DEFAULT) {
          params.delete('period');
        } else {
          params.set('period', next);
        }
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  return (
    <div className="space-y-6">
      <InboxHeadlineCards stats={headlineStats} period={period} onPeriodChange={setPeriod} />
      <InboxActivityFeed siteName={siteName} initialPage={activityPage} />
    </div>
  );
}
