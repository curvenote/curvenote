---
title: OKTA
description: Documentation on using the OKTA authentication provider
---

[OKTA](https://www.okta.com/) is an identity management platform that provides SSO, authentication and authorization.

The Curvenote platform implements authentication using `remix-auth` strategies. A strategy for OKTA authentication is
bundled using the [curvenote/remix-auth-okta](https://github.com/curvenote/remix-auth-okta) package and only requires configuration.

# Configuration

OKTA Authentication is enabled by adding details to the deployment configuration following the schema:

```{literalinclude} ../.app-config.schema.yml
:linenos:
:lines: 13,14,15,51-70
```

For example:

```{code} yaml
:filename: .app-config.development.yml
auth:
  okta:
    domain: https://dev-121212AB.okta.com
    clientId: <oidc-application-client-id>
    redirectUrl: http://localhost:3031/auth/okta/callback
    provisionNewUser: true
```

domain
: The origin URL of the OKTA instance

clientId
: The Client ID provided by the OIDC application being deployed to

redirectUrl
: The callback url that will be provided to OKTA always at the relative path `/auth/okta/callback` on a Curvenote deployment

provisionNewUser
: (default: false) If true, on successful authentication a new user will be created in the database with a linked OKTA account. Otherwise, an error is throw.

---

```{code} yaml
:filename: .app-config.development.secrets.yml
auth:
  okta:
    clientSecret: <oidc-application-client-secret>
```

clientSecret
: The Client Secret provided by the OIDC application being deployed to

# OKTA Developer Access

In order to fully deploy OKTA authentication you'll need access to an OKTA instance or have credentials for suitably configured [Web Application Integrations](https://support.okta.com/help/s/article/create-an-oidc-web-app-in-dashboard) to deploy against with credentials they provide.

For development purposes, OKTA provides [developer resources](https://developer.okta.com/) and developer accounts for use when building and testing integrations.

Within the OKTA workspace for a developer account an [OIDC App](https://openid.net/developers/how-connect-works/) can be created, configured and development credentials accessed.

:::{image} images/okta-test-app.png
:::
