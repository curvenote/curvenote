import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export function loader({ params }: LoaderFunctionArgs) {
  throw redirect(`/app/sites/${params.siteName}/submissions`);
}

// TODO is this still needed?
export default function () {
  return <div />;
}
