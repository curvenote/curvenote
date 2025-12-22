import { Badge, ProfileCardContent, LoginUI } from './google/ui.js';
import {
  FirebaseEmailBadge,
  ProfileCardContent as FirebaseMailProfileCardContent,
  FirebasePasswordLoginUI,
} from './firebase/ui.js';
import {
  Badge as OktaBadge,
  ProfileCardContent as OktaProfileCardContent,
  LoginUI as OktaLoginUI,
} from './okta/ui.js';
import {
  Badge as ORCIDBadge,
  ProfileCardContent as ORCIDProfileCardContent,
  LoginUI as ORCIDLoginUI,
} from './orcid/ui.js';
import type { FirebaseProfile } from './firebase/types.js';
import type { OktaProfile } from '@curvenote/remix-auth-okta';

export function ProviderBadge({ provider, ...props }: { provider: string }) {
  switch (provider) {
    case 'google':
      return <Badge {...props} />;
    case 'firebase-email':
      return <FirebaseEmailBadge {...props} />;
    case 'okta':
      return <OktaBadge {...props} />;
    case 'orcid':
      return <ORCIDBadge {...props} />;
    default:
      return <div className="capitalize">{provider}</div>;
  }
}

type ORCIDProfile = any;

export type AuthProviderComponents = {
  Badge: React.FC<{ className?: string; size?: number; showName?: boolean }>;
  ProfileCardContent: React.FC<{
    profile: FirebaseProfile | OktaProfile | ORCIDProfile;
    children: React.ReactNode;
  }>;
  LoginUI: React.FC<{
    disabled: boolean;
    setSubmitting: (flag: boolean) => void;
  }>;
};

export const AuthComponentMap: Record<string, AuthProviderComponents> = {
  google: {
    Badge,
    ProfileCardContent,
    LoginUI,
  },
  'firebase-email': {
    Badge: FirebaseEmailBadge,
    ProfileCardContent: FirebaseMailProfileCardContent,
    LoginUI: FirebasePasswordLoginUI,
  },
  okta: {
    Badge: OktaBadge,
    ProfileCardContent: OktaProfileCardContent,
    LoginUI: OktaLoginUI,
  },
  orcid: {
    Badge: ORCIDBadge,
    ProfileCardContent: ORCIDProfileCardContent,
    LoginUI: ORCIDLoginUI,
  },
};
