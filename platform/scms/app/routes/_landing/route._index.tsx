import type { ActionFunction, MetaFunction } from 'react-router';
import { Link } from 'react-router';
import {
  useDeploymentConfig,
  error405,
  getBrandingFromMetaMatches,
  ui,
} from '@curvenote/scms-core';

export const meta: MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    { title: branding.title },
    {
      name: 'description',
      content: branding.description,
    },
  ];
};

export const action: ActionFunction = async () => {
  throw error405();
};

export default function Index() {
  const { branding } = useDeploymentConfig();
  return (
    <section className="flex flex-col justify-center py-32 sm:py-0">
      <div className="flex flex-col items-center justify-center">
        {branding?.subtitle && <p className="mt-4 text-xl font-light">{branding.subtitle}</p>}
        {branding?.showLoginLink && (
          <div className="flex flex-wrap items-center justify-center gap-3 my-8">
            <ui.Button asChild variant="default" size="lg">
              <Link to="/login">Sign in</Link>
            </ui.Button>
            <ui.Button asChild variant="outline" size="lg">
              <Link to="/signup">Sign up</Link>
            </ui.Button>
          </div>
        )}
      </div>
    </section>
  );
}
