import { redirect } from 'react-router';

export function loader() {
  throw redirect('inbox');
}

export default function () {
  return <div />;
}
