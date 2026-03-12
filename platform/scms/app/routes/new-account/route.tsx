import { PoweredByCurvenoteText } from '../_auth/PoweredByCurvenoteText';
import { Outlet } from 'react-router';

export default function SignupLayout() {
  return (
    <div data-name="signup-layout">
      <Outlet />
      <div className="flex fixed right-0 bottom-0 left-0 justify-end p-2">
        <PoweredByCurvenoteText message="Welcome to" />
      </div>
    </div>
  );
}
