# Navigation Scopes Documentation

## Overview

The navigation configuration in your app config supports fine-grained access control through scopes. This allows you to show/hide navigation items based on the user's permissions at both system and site levels.

## How Scopes Work

When a user logs in, the system automatically computes their scopes using `getUserScopesSet()`:

1. **System scopes**: Global permissions like `system:admin`, `platform:admin`
2. **Site-specific scopes**: Site roles get transformed into site-qualified scopes
   - User with `ADMIN` role on `abc` site gets scope: `site:admin:abc`
   - User with `EDITOR` role on `scipy` site gets scope: `site:update:scipy`

## Navigation Configuration Examples

### System-Level Scopes

```yaml
# .app-config.development.yml
app:
  navigation:
    - name: platform
      label: Platform Admin
      icon: platform
      path: platform
      scopes:
        - "system:admin"        # Only system admins see this

    - name: works
      label: My Works
      icon: files
      path: works
      # No scopes = visible to all authenticated users
```

### Site-Specific Scopes

```yaml
app:
  navigation:
    - name: abc-admin
      label: ABC Admin
      icon: abc
      path: sites/abc/admin
      scopes:
        - "site:admin:abc"      # Only ABC site admins see this

    - name: scipy-editor
      label: SciPy Editor
      icon: edit
      path: sites/scipy/submissions
      scopes:
        - "site:submissions:update:scipy"  # Only SciPy editors+ see this

    - name: multi-site-admin
      label: Multi-Site Admin
      icon: crown
      path: super-admin
      scopes:
        - "site:admin:abc"      # Must have admin on ABC
        - "site:admin:scipy"    # AND admin on SciPy
```

### Mixed Scopes

```yaml
app:
  navigation:
    - name: site-manager
      label: Site Manager
      icon: settings
      path: site-management
      scopes:
        - "system:admin"        # System admins always see this
        - "site:admin:abc"      # OR ABC admins see this
      # Note: This is OR logic - user needs ANY of these scopes
```

## Available Site Scopes

Based on `app/scopes.ts`, here are the available site scopes:

### Basic Site Scopes
- `site:list` - Can list sites
- `site:read` - Can read site content
- `site:update` - Can update site settings
- `site:details` - Can view site details (app-only scope)

### Domain Management
- `site:domains:list` - List site domains
- `site:domains:create` - Add domains
- `site:domains:update` - Update domains
- `site:domains:delete` - Remove domains

### Submission Management
- `site:submissions:list` - List submissions
- `site:submissions:read` - Read submissions
- `site:submissions:create` - Create submissions
- `site:submissions:update` - Edit submissions
- `site:submissions:delete` - Delete submissions
- `site:submissions:publishing` - Publish submissions
- `site:submissions:versions:create` - Create submission versions

### Content Types & Collections
- `site:kinds:list` - List content types
- `site:kinds:read` - Read content types
- `site:kinds:create` - Create content types
- `site:kinds:update` - Update content types
- `site:kinds:delete` - Delete content types
- `site:collections:list` - List collections
- `site:collections:read` - Read collections
- `site:collections:create` - Create collections
- `site:collections:update` - Update collections
- `site:collections:delete` - Delete collections

### User Management
- `site:users:list` - List site users
- `site:users:read` - Read user details
- `site:users:create` - Add users to site
- `site:users:update` - Update user roles
- `site:users:delete` - Remove users from site

## Site Role to Scope Mapping

The system automatically maps site roles to scopes:

| Site Role | Gets These Scopes |
|-----------|-------------------|
| `ADMIN` | All site scopes (full access) |
| `EDITOR` | Read, update submissions, publish, manage content types/collections |
| `SUBMITTER` | Read, create submissions and versions |
| `REVIEWER` | Read-only access |
| `AUTHOR` | Read-only access |
| `PUBLIC` | Read-only access |
| `UNRESTRICTED` | Read, browse, create submissions |

## Usage in Configuration

To use site-specific scopes in your navigation:

1. **Identify the scope needed**: Look at the tables above
2. **Add the site name**: Append `:{siteName}` to the scope
3. **Add to navigation config**: Include in the `scopes` array

### Example
```yaml
# Show "Submission Manager" only to users who can manage submissions on the "abc" site
- name: abc-submissions
  label: Submission Manager
  icon: file-text
  path: sites/abc/submissions
  scopes:
    - "site:submissions:update:abc"
```

## Testing

The functionality is thoroughly tested in `app/utils.server.spec.ts`. Run tests with:

```bash
npm run test:unit -- app/utils.server.spec.ts
```

## Notes

- **All scopes required**: If multiple scopes are listed, the user must have ALL of them
- **Case sensitive**: Scope names are case-sensitive
- **Site names**: Must match the exact site name in the database
- **Automatic computation**: Scopes are automatically computed when the user logs in
- **Performance**: Scope checking uses efficient Set lookups for fast performance
