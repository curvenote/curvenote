import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useNavigate } from 'react-router';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, scopes } from '@curvenote/scms-core';
import { withAppSiteContext } from '@curvenote/scms-server';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { primitives, ui } from '@curvenote/scms-core';
import { useEffect, useState } from 'react';

type LoaderData = {
  siteName: string;
  siteTitle: string;
  formName: string;
  workId: string | null;
  isLoggedIn: boolean;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.forms.read]);

  // Get formName from params - it should be available from the parent route
  // If not in current params, try to extract from URL path
  let formName = args.params.formName;
  if (!formName) {
    // Fallback: extract from URL path
    const pathMatch = args.request.url.match(/\/submit\/([^/]+)\/success/);
    formName = pathMatch ? pathMatch[1] : undefined;
  }
  if (!formName) throw new Error('Missing form name');

  const searchParams = new URL(args.request.url).searchParams;
  const workId = searchParams.get('workId');

  return {
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    formName,
    workId,
    isLoggedIn: !!ctx.user,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle('Submission Successful', loaderData?.siteName, branding.title),
    },
  ];
};

export default function SubmitSuccess({ loaderData }: { loaderData: LoaderData }) {
  const { siteName, siteTitle, formName, workId, isLoggedIn } = loaderData;
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const workUrl = workId ? `/app/works/${workId}` : null;

  useEffect(() => {
    if (isLoggedIn && workUrl && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, isLoggedIn, workUrl]);

  useEffect(() => {
    if (isLoggedIn && workUrl && countdown === 0) {
      navigate(workUrl);
    }
  }, [countdown, isLoggedIn, workUrl, navigate]);

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle || siteName, href: `/app/sites/${siteName}/inbox` },
    { label: 'Submission Successful', isCurrentPage: true },
  ];

  return (
    <PageFrame
      className="max-w-2xl"
      title="Submission Successful"
      subtitle="Your submission has been received"
      breadcrumbs={breadcrumbs}
    >
      <primitives.Card className="p-8 text-center" lift>
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full dark:bg-green-900">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>

          <div>
            <h2 className="mb-2 text-2xl font-semibold">Thank you for your submission!</h2>
            <p className="text-stone-600 dark:text-stone-400">
              Your submission has been successfully received and is being processed.
            </p>
          </div>

          {isLoggedIn && workUrl ? (
            <div className="flex flex-col items-center w-full gap-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {countdown > 0
                  ? `Redirecting to your work in ${countdown} second${countdown !== 1 ? 's' : ''}...`
                  : 'Redirecting...'}
              </p>
              <ui.Button variant="default" onClick={() => navigate(workUrl)} className="gap-2">
                Go to Work Now
                <ArrowRight className="w-4 h-4" />
              </ui.Button>
            </div>
          ) : (
            <div className="p-4 text-sm text-center text-blue-800 rounded bg-blue-50 dark:bg-blue-900/20 dark:text-blue-200">
              <p className="font-medium">Next Steps</p>
              <p className="mt-2">
                Please check your email for further instructions and updates about your submission.
              </p>
            </div>
          )}
        </div>
      </primitives.Card>
    </PageFrame>
  );
}
