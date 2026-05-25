import { Link } from 'react-router';

export function ClassicInboxRedirect({ siteName }: { siteName: string }) {
  return (
    <div className="mt-4 text-sm text-muted-foreground">
      Looking for the old inbox experience?{' '}
      <Link
        to={`/app/sites/${siteName}/inbox-classic`}
        className="text-blue-600 underline hover:text-blue-800"
      >
        Open the classic inbox
      </Link>
      .
    </div>
  );
}
