import { Link } from 'react-router';

export function ClassicDesignRedirect({ siteName }: { siteName: string }) {
  return (
    <div className="mt-4 text-sm text-muted-foreground">
      Something look wrong?{' '}
      <Link
        to={`/app/sites/${siteName}/website-classic`}
        className="text-blue-600 underline hover:text-blue-800"
      >
        Return to classic design page
      </Link>
      .
    </div>
  );
}
