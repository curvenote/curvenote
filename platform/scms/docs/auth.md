---
title: Auth Modules
description: Explanation of the structure and behavior of auth modules
---

Auth modules are located in `app/modules/auth`. New auth providers can be added by implementing a new modules and building on [remix-auth](https://github.com/sergiodxa/remix-auth) and in particular [remix-auth-oauth2](https://github.com/sergiodxa/remix-auth-oauth2) strategies.

## Module structure

```
- auth/{name}
    - auth.callback.tsx
    - auth.tsx
    - logo.svg
    - register.server.ts
    - schema.yml
    - types.ts
    - ui.tsx
```

`auth.tsx` and `auth.callback.tsx`
: Remix resource route handlers that can implement 0Auth2.0 3-legged authentication but can be used for custom authentication patterns too.

`logo.svg`
: Include UI assets as needed.

`register.server.ts`
: The `VerifyFunction` used in all `remix-auth` strategies.

`schema.yml`
: A fragment of the `app-config` schema related to this module (not implemented yet). Forward looking idea is this will be composed into the overall app schema.

`types.ts`
: Define any types to be used outside of this module.

`ui.tsx`
: Expected UI components `Badge`, `ProfileCard` and `LoginUI`

## Implementation Checklist

- [ ] Consider how existing `auth` options (`allowLogin`, `allowLinking`, `provisionNewUser`) will impact your authentication flow and whether to support/implement them.
  - `allowLogin` should remove any login UI and prevent `/auth/{name}` from triggering a login flow
  - `allowLinking` will give users the ability to link this account from their settings page in-app
  - `provisionNewUser` will create a new user account in the database when a user cannot be found using the linked account details. If set, this will override `allowLinking`.
- [ ] Consider the structure of the User's Profile information deciding what you will store. The profile will be stored in the database and in the provider specific cookie.
- [ ] Extend the `ClientSideSafeAuthOptions` type in `app/modules/auth/types.ts`
- [ ] Implement your custom `remix-auth` strategy or configure an instance of an `OAuth2Strategy` and return this from a `register{Name}Strategy` function in `register.server.ts`.
- [ ] Register your new provider in `authenticatorFactory()` in `app/modules/auth/auth.server.ts`
- [ ] Add a new section, `auth.{name}`, to `.app-config.schema.yml` and update the `.app-config.development.yml` and `.app-config.development.secrets.yml` to enable local development.
- [ ] Implement the `Badge`, `ProfileCard` and `LoginUI` components following the pattern in other modules
  - `Badge` is an icon/logo with a name
  - `ProfileCard` is used in the `app.settings.linked-accounts/` route.
  - `LoginUI` is used in `_auth.login.tsx`
- [ ] Extend `AuthComponentMap` and `ProviderBadge` in `app/modules/auth/auth.tsx`
- [ ] Extend the default component in `_auth.login.tsx` to display your `LoginUI`
- [ ] Implement the route handlers in `auth.tsx`, `auth.callback.tsx` and the `VerifyFunction` appropriately for your authentication method. See the `orcid` provider for an example of a plain OAuth2.0 pattern.

## Additional Integration Points

The following integration points should not require manual modification when adding a new auth module.

- `vite.config.mjs` the `routes()` function of the Vite `remix` plugin is set up to automatically mount the OAuth2 route handlers from your module, when it is present in the app config
- The root `loader` (`root.tsx`) builds a `ClientDeploymentConfig` object that is shared across the front end by the `useDeploymentConfig()` hook. That object includes minimal (and carefully vetted, checked) options taken from the `auth` section of the `app-config`. This will only need to change if new options are defined for existing or new providers.

## Implementing Route Handlers

### `module/{name}/auth.tsx`

The `module/{name}/auth.tsx` will handle an API resource route at `auth/{name}`. In an OAuth2.0 flow it's job is simply to call the `authenticate` method to kick of the `OAuth2` flow.

```
export async function action(args: ActionFunctionArgs) {
  return withContext(args, async (ctx) => {
    await ctx.$auth.authenticate('okta', args.request);
    return null;
  });
}
```

If the module supports the `allowLogin` configuration option, it should reject any request where there is not a valid user session

```
export async function action(args: ActionFunctionArgs) {
  return withContext(args, async (ctx) => {
    const sessionStorage = await sessionStorageFactory();
    const session = await sessionStorage.getSession(args.request.headers.get('Cookie'));
    const allowLogin = ctx.$config.auth?.orcid?.allowLogin;
    const loggedInUser = session.get('user');
    if (!allowLogin && !loggedInUser) {
      throw redirect('/login');
    }
    await ctx.$auth.authenticate('orcid', args.request);
    return null;
  });
}
```

If you are not using `OAuth2` then it may be appropriate to complete authentication here in one step, that depends on your strategy. See `app/modules/auth/firebase` for an example.

### `module/{name}/auth.callback.tsx`

The `module/{name}/auth.callback.tsx` handles the final part of the `OAuth2` flow, it's responsibilities are:

- Check for a current user session and if `allowLinking` is supported, provide an alternate redirect to `/app/settings/linked-accounts`.
- In both login and linking flows, set any additional provider cookie, via the returned `providerSetCookie` string.
- In the login flow, set the `user` object from the `authenticate(...)` call and set it in a session cookie on redirect to `/app`.

If you are not using `OAuth2`, this handler should still be implemented but could be a no-op just redirecting to `/app`.

## Implementing VerifyFunction

:::{tip} Firebase special case
:class: dropdown
The way in which the Curvenote Platform has evolved means that Firebase is currently treated as a special case, as it is a social login provider in itself
as well as a database running the platform.

When firebase is used is can be linked to the same google client as is used in the google provider, which google social login is enabled in firebase.
Also the platform integrates firebase in a couple of places outside of the `modules/auth` and `modules/database` modules, this is something that we should
abstract out at a later date.
:::

This `VerifyFunction` is the critical part of the auth flow, using `orcid` via `OAuth2` as an example, we step through the behaviors below.

1. Arguments to the function are `{ tokens, request }`, decode `tokens.idToken()` and validate claims, at least the `exp`, throwing a failure redirect if it has expired.
2. Get the User record from the third-party API using `tokens.accessToken()` and use this to construct the `profile` object you intent to store.
3. Lookup user by `dbGetUserByLinkedAccount('orcid', idPayload.sub)`
4. Get the `allowLinking` and `provisionNewUser` options and then implement the following if-else cascade:
   1. If we have a valid user with these linked account details, optionally upsert/refresh the profile information using `dbUpdateUserLinkedAccountProfile` and allow through
   2. If no user and `provisionNewUser` is set, call `dbCreateUserWithPrimaryLinkedAccount`
   3. if no user and `allowLinking` is set
      1. check for a logged in user
      2. if not logged in, redirect to `/link-accounts?provider={name}`
      3. otherwise call `handleAccountLinking`
5. If still no user, redirect to `failureRedirectUrl`
6. Generate a SetProviderCookie string
7. Return a `AuthenticatedUserWithProviderCookie` object
