import { Authenticator } from 'remix-auth';
import { getConfig } from '../../app-config.server.js';
import { registerGoogleStrategy } from './google/register.server.js';
import { registerFirebaseStrategy } from './firebase/register.server.js';
import { registerOktaStrategy } from './okta/register.server.js';
import { registerOrcidStrategy } from './orcid/register.server.js';
import type { AuthenticatedUserWithProviderCookie } from '../../session.server.js';

export type AppAuthenticator = Authenticator<AuthenticatedUserWithProviderCookie>;

let authenticator: AppAuthenticator | null = null;

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session

export async function authenticatorFactory() {
  if (authenticator != null) return authenticator;
  authenticator = new Authenticator<any>();
  const config = await getConfig();

  const authProviders = config.auth;
  for (const provider in authProviders) {
    // TODO some dynamic module loading thing
    if (provider === 'google') {
      registerGoogleStrategy(config, authenticator);
    }
    if (provider === 'firebase') {
      registerFirebaseStrategy(config, authenticator);
    }
    if (provider === 'okta') {
      registerOktaStrategy(config, authenticator);
    }
    if (provider === 'orcid') {
      registerOrcidStrategy(config, authenticator);
    }
  }
  return authenticator;
}
