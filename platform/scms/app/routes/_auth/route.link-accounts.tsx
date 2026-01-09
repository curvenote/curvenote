import { Link, useSearchParams } from 'react-router';
import { AuthComponentMap, error405 } from '@curvenote/scms-core';

export async function loader() {
  return null;
}

export async function action() {
  throw error405();
}

export default function LinkAccounts() {
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider');

  const Badge = provider ? AuthComponentMap[provider]?.Badge : null;

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-4xl font-light">Link Accounts</h1>
      {Badge && (
        <div className="flex flex-col space-y-8">
          <div className="flex justify-center mt-4">
            <Badge className="scale-150" showName />
          </div>
          <p>
            To link your <span className="font-semibold">{provider}</span> account, please login as
            normal and link your account on the{' '}
            <span className="font-light text-stone-500 hover:underline">
              <Link to="/app/settings/linked-accounts">Linked Accounts</Link>
            </span>{' '}
            in page in{' '}
            <span className="font-light text-stone-500 hover:underline">
              <Link to="/app/settings">Settings</Link>
            </span>
            .
          </p>
        </div>
      )}
      {!Badge && (
        <p>
          To link an account to your Curvenote account, please login normally and link your account
          on the{' '}
          <span className="font-light text-stone-500 hover:underline">
            <Link to="/app/settings/linked-accounts">Linked Accounts</Link>
          </span>{' '}
          in{' '}
          <span className="font-light text-stone-500 hover:underline">
            <Link to="/app/settings">Settings</Link>
          </span>
          .
        </p>
      )}
    </div>
  );
}
