# Extensions

This folder may contain extensions that can be loaded into Curvenote SCMS applications.

## Extension Structure

Extensions placed in this folder must follow a specific structure:

### Required: Main Entry Point

Each extension must have a main entry point that exports an `extension` object. This is typically the server-side extension configuration.

**Example:**
```typescript
// src/index.ts
export { extension } from './server.js';
```

The extension's `package.json` should configure the main export:
```json
{
  "main": "./dist/index.js",
  "exports": {
    ".": {
      "node": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

### Optional: Client Entry Point

Extensions may also provide a secondary client entry point that exports a client-only `extension` object. This is useful for client-side components, UI elements, and browser-only functionality.

**Example:**
```typescript
// src/client.ts
export const extension: ClientExtension = {
  id,
  name,
  description,
  getTasks,
  getIcons,
  getAnalyticsEvents,
  getEmailTemplates,
  registerNavigation,
} as const;
```

The extension's `package.json` should configure the client export:
```json
{
  "exports": {
    ".": {
      "node": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js",
      "require": "./dist/client.js",
      "default": "./dist/client.js"
    }
  }
}
```
