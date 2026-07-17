-- Read-only ETL history / feed consumers — distinct from site ADMIN/SUBMITTER.
ALTER TYPE "public"."SiteRole" ADD VALUE 'FEED';
