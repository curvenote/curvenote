import { redirect } from 'react-router';

export function loader() {
  throw redirect('/app');
}

// TODO is this still needed?
export default function () {
  return <div />;
}
