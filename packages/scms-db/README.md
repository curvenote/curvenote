# @curvenote/scms-db

Database package for Curvenote SCMS applications using Prisma 7.

This package encapsulates all Prisma concerns and provides clean exports for both server-side and browser-side code.

## Structure

- **Server Entry** (`./src/index.ts`): Exports `getPrismaClient()` function and Prisma types for server-side usage
- **Browser Entry** (`./src/browser.ts`): Exports browser-safe types, enums, and utilities (no server code)

## Usage

### Server-Side (Loaders, Actions, API Routes)

```ts
import { getPrismaClient } from '@curvenote/scms-db';

export async function loader() {
  const prisma = await getPrismaClient();
  const users = await prisma.user.findMany();
  return { users };
}
```

### Browser-Side (React Components)

```ts
import { UserRole, type User } from '@curvenote/scms-db';

function UserBadge({ role }: { role: UserRole }) {
  return role === UserRole.ADMIN ? <span>Admin</span> : <span>User</span>;
}
```

## Configuration

The Prisma schema is located at `../../prisma/schema/` (relative to this package).

The generated client is output to `./src/generated/` and is gitignored.

## Development

Generate the Prisma client:

```bash
npm run generate
```

Format the Prisma schema:

```bash
npm run format
```
