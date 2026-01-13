import { Link } from 'react-router';

export function ClassicCollectionsRedirect({ siteName }: { siteName: string }) {
  return (
    <div className="text-sm text-muted-foreground mt-4">
      Something look wrong?{' '}
      <Link
        to={`/app/sites/${siteName}/collections-classic`}
        className="text-blue-600 underline hover:text-blue-800"
      >
        Return to classic collections page
      </Link>
      .
    </div>
  );
}
