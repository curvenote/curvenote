import { Rocket } from 'lucide-react';
import { Link } from 'react-router';

export function SubmissionsComingSoon({ siteName }: { siteName: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex justify-center items-center mb-6 w-24 h-24 rounded-full ring-1 shadow-sm bg-primary/10 ring-primary/10">
        <Rocket className="w-12 h-12 text-primary" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="max-w-md text-2xl font-semibold tracking-tight text-foreground">
        Your new submissions experience will be here soon!
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Meanwhile,{' '}
        <Link
          to={`/app/sites/${siteName}/submissions-classic`}
          className="text-blue-600 underline hover:text-blue-800"
        >
          browse all submissions
        </Link>
        .
      </p>
    </div>
  );
}
