import type { ActionFunction, MetaFunction } from 'react-router';
import { redirect, Form, Link, useNavigation } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { ClientDeploymentConfig } from '@curvenote/scms-core';
import { sessionStorageFactory, getInvalidateProviderCookie } from '@curvenote/scms-server';

export const meta: MetaFunction = ({ matches }) => {
  const { data } = matches.find(({ id }) => id === 'root') as {
    data: { clientSideConfig: ClientDeploymentConfig };
  };
  const { branding } = data.clientSideConfig;
  return [
    {
      title: `Log out | ${branding?.title ?? 'Curvenote'}`,
    },
  ];
};

export const action: ActionFunction = async ({ request }) => {
  const sessionStorage = await sessionStorageFactory();
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  const headers = new Headers();
  headers.append('Set-Cookie', await sessionStorage.destroySession(session));
  if (user?.provider) {
    headers.append('Set-Cookie', getInvalidateProviderCookie(user?.provider));
  }
  return redirect('/login', { headers });
};

export default function LogoutRoute() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="flex items-center justify-center w-full bg-white dark:bg-gray-900">
      <div className="px-4 space-y-10">
        <div className="space-y-2">
          <h1>Are you sure you want to log out?</h1>
        </div>
        <Form method="POST">
          <ui.StatefulButton size="lg" type="submit" busy={isSubmitting} overlayBusy>
            Log Out
          </ui.StatefulButton>
        </Form>
        <Link to="/" className="block ml-2 underline text-stone-800 dark:text-stone-100">
          No, keep me logged in!
        </Link>
      </div>
    </div>
  );
}
