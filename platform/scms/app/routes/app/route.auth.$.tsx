import { error404 } from '@curvenote/scms-core';

export function loader() {
  throw error404();
}

export default function () {
  return null;
}
