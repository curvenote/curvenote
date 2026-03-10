# React Router routes (platform/scms)

When **adding or changing routes** in `platform/scms`:

1. **Register the route in `app/routes.ts`**  
   Add the route in the correct `layout` / `prefix` (e.g. `route('new', 'routes/app/works.new/route.tsx')`). The typegen only generates `+types` for routes that are declared in `routes.ts`.

2. **Use generated route types in the route file**  
   In the route module, use:
   - `import type { Route } from './+types/route'`
   - `Route.MetaFunction`, `Route.ComponentProps`, `Route.LoaderArgs`, `Route.LoaderData`, etc., as appropriate.

3. **Run typegen after route changes**  
   From `platform/scms`, run **`npm run compile`** (which runs `react-router typegen` then `tsc --noEmit`). Do this after adding or moving routes so that `./+types/route` exists and TypeScript resolves correctly.

If a route has **no action** but the component uses `useFetcher` to submit to another route, type the fetcher explicitly (e.g. `useFetcher<SomeResponseType>()`) because the generated `Route.ComponentProps['actionData']` will be `never`.
