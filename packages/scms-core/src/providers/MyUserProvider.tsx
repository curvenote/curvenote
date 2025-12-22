import { createContext, useEffect, useContext, useState } from 'react';
import type { MyUserDTO } from '@curvenote/common';

export type MyUserWithAccountsDTO = MyUserDTO & {
  linkedAccounts?: Array<{
    id: string;
    provider: string;
    idAtProvider: string | null;
    email: string | null;
    profile: any;
    pending: boolean;
    date_linked: string | null;
  }>;
};

export type MyUser = MyUserWithAccountsDTO & {
  avatar: string;
  scopes: string[];
};

type MyUserContextType = { user: MyUser | null };

const MyUserContext = createContext<MyUserContextType | undefined>(undefined);

export function MyUserProvider({
  children,
  user,
  scopes,
}: {
  children: React.ReactNode;
  user: MyUserWithAccountsDTO | null;
  scopes: string[] | null;
}) {
  const [myUser, setMyUser] = useState<MyUser | null>(null);

  useEffect(() => {
    if (!user) return;
    setMyUser({
      ...user,
      avatar: '', // we'll need to do something appropriate per-auth-provider to get images
      scopes: scopes ?? [],
    });
  }, [user]);

  return <MyUserContext.Provider value={{ user: myUser }}>{children}</MyUserContext.Provider>;
}

export function useMyUser() {
  const context = useContext(MyUserContext);
  if (context === undefined) {
    throw new Error('useMyUser must be used within a MyUserProvider');
  }
  return context.user;
}
