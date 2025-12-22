import { Outlet } from 'react-router';

export function loader() {
  return null;
}

export default function WorkSiteRoute() {
  return (
    <div data-name="work-site-route">
      <Outlet />
    </div>
  );
}
