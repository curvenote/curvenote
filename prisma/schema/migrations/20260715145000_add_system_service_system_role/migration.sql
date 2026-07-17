-- Platform-level machine users (e.g. submissionsServiceAccount) — distinct from site SERVICE accounts.
ALTER TYPE "public"."SystemRole" ADD VALUE 'SYSTEM_SERVICE';
