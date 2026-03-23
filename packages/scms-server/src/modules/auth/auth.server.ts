import { Authenticator } from 'remix-auth';
import { getConfig } from '../../app-config.server.js';
import { registerGitHubStrategy } from './github/register.server.js';
import { registerGoogleStrategy } from './google/register.server.js';
import { registerFirebaseStrategy } from './firebase/register.server.js';
import { registerOktaStrategy } from './okta/register.server.js';
import { registerOrcidStrategy } from './orcid/register.server.js';
import { registerBlueskyStrategy } from './bluesky/register.server.js';
import type { AuthenticatedUserWithProviderCookie } from '../../session.server.js';

export type AppAuthenticator = Authenticator<AuthenticatedUserWithProviderCookie>;

let authenticator: AppAuthenticator | null = null;

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session

export async function authenticatorFactory() {
  if (authenticator != null) return authenticator;
  const config = await getConfig();

  // Build into a local instance first. If Bluesky (or another async registration) throws,
  // we must not cache an Authenticator that is missing strategies — that caused
  // "Strategy bluesky not found" on later requests after a failed first init.
  const next = new Authenticator<any>();
  const authProviders = config.auth;
  for (const provider in authProviders) {
    // TODO some dynamic module loading thing
    if (provider === 'github') {
      registerGitHubStrategy(config, next);
    }
    if (provider === 'google') {
      registerGoogleStrategy(config, next);
    }
    if (provider === 'firebase') {
      registerFirebaseStrategy(config, next);
    }
    if (provider === 'okta') {
      registerOktaStrategy(config, next);
    }
    if (provider === 'orcid') {
      registerOrcidStrategy(config, next);
    }
    if (provider === 'bluesky') {
      await registerBlueskyStrategy(config, next);
    }
  }
  authenticator = next;
  return authenticator;
}
