# Routing Changes

Routing is defined in `app/routes.ts` as per React Router v7 routing conventions leaving us free to organise route files as we see fit.

Conventions for this folder are:

- Use folders for routes where is makes sense, i.e. where there is a need for mulitple files
- Continue to use remix naming conventions for folder and file names for clarity, although these will no longer contirbute to routing logic.
- prefix file based routes in this folder with `route.*` for clarity.
