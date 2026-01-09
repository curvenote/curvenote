/**
 * Options that are safe to pass to the client side
 */
export interface FirebaseClientSideSafeOptions {
  provider: 'firebase';
  displayName?: string;
  actionTitle?: string;
  allowLinking?: false;
  provisionNewUser?: boolean;
  allowLogin?: boolean;
  adminLogin?: boolean;
}

export type FirebaseProfile = {
  uid: string;
  name: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  photoURL: string;
  idToken?: string;
};
