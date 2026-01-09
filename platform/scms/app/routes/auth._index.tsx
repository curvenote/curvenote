import { redirect } from 'react-router';

export async function loader() {
  console.log('auth._index loader');
  throw redirect('/404');
}
