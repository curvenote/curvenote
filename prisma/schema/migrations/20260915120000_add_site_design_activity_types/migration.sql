-- ActivityType: site admin changes to design, fonts, redirects, and font license verification
ALTER TYPE "ActivityType" ADD VALUE 'SITE_DESIGN_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'SITE_FONTS_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'SITE_REDIRECTS_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'FONT_LICENSE_VERIFIED';
ALTER TYPE "ActivityType" ADD VALUE 'FONT_LICENSE_UNVERIFIED';
