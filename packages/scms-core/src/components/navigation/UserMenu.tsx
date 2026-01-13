import { Link } from 'react-router';
// components
import { useMyUser } from '../../providers/MyUserProvider.js';
import { Caption } from '../primitives/Caption.js';
import { CircleUserRound, User, Link2, KeyRound, Mail, LogOut } from 'lucide-react';

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '../../components/ui/menu.js';

function UserMenuPanel() {
  const user = useMyUser();

  if (!user) return null;

  return (
    <>
      {/* User Info Header */}
      <div className="flex flex-col px-3 py-3 border-b border-stone-200 dark:border-stone-700">
        <p className="text-sm font-medium truncate text-stone-900 dark:text-stone-100">
          {user.display_name}
        </p>
        <Caption className="truncate text-stone-600 dark:text-stone-400">{user.email}</Caption>
      </div>

      {/* Settings Options */}
      <MenuItem asChild>
        <Link to="/app/settings/account" className="flex items-center cursor-pointer">
          <User className="w-4 h-4 mr-3" />
          Account Settings
        </Link>
      </MenuItem>
      <MenuItem asChild>
        <Link to="/app/settings/linked-accounts" className="flex items-center cursor-pointer">
          <Link2 className="w-4 h-4 mr-3" />
          Linked Accounts
        </Link>
      </MenuItem>
      <MenuItem asChild>
        <Link to="/app/settings/tokens" className="flex items-center cursor-pointer">
          <KeyRound className="w-4 h-4 mr-3" />
          My Tokens
        </Link>
      </MenuItem>
      <MenuItem asChild>
        <Link to="/app/settings/emails" className="flex items-center cursor-pointer">
          <Mail className="w-4 h-4 mr-3" />
          Email Preferences
        </Link>
      </MenuItem>

      {/* Separator */}
      <MenuSeparator />

      {/* Logout */}
      <MenuItem
        onClick={(e) => {
          // Prevent the menu from closing
          e.preventDefault();
          e.stopPropagation();
          // Create and submit the form programmatically
          // We do this because the form is in a different portal and the menu will close before the form is submitted
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/logout';
          form.style.display = 'none';
          document.body.appendChild(form);
          form.submit();
        }}
        className="flex items-center cursor-pointer"
      >
        <LogOut className="w-4 h-4 mr-3" />
        Log out
      </MenuItem>
    </>
  );
}

export function UserMenu() {
  const user = useMyUser();

  if (!user) return null;

  return (
    <div className="flex flex-col items-start justify-end space-y-2">
      <Menu>
        <MenuTrigger asChild>
          <button className="flex items-center justify-center rounded-full cursor-pointer sm:w-10 sm:h-10 hover:bg-accent hover:text-accent-foreground">
            {/* <Avatar className="w-full h-full"> */}
            <CircleUserRound className="stroke-[1.5] w-7 h-7" />
            {/* <AvatarFallback>{user.display_name?.charAt(0)}</AvatarFallback> */}
            {/* </Avatar> */}
          </button>
        </MenuTrigger>
        <MenuContent className="z-30 w-64 p-0 mb-2" align="start" side="top">
          <UserMenuPanel />
        </MenuContent>
      </Menu>
    </div>
  );
}
