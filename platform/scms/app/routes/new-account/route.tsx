import { PoweredByCurvenoteText } from '../_auth/PoweredByCurvenoteText';
import { Outlet } from 'react-router';

export default function SignupLayout() {
  return (
    <div data-name="signup-layout">
      <Outlet />
      <div className="fixed bottom-0 left-0 right-0 flex justify-end p-2">
        <PoweredByCurvenoteText message="Welcome to" />
      </div>
    </div>
  );
}
