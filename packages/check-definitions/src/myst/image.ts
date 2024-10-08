import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.imageDownloads,
    title: 'Image Downloads',
    purpose: 'Remote images are downloaded successfully.',
  },
  {
    id: RuleId.imageExists,
    title: 'Image Exists',
    purpose: 'The image exists on disk.',
  },
  {
    id: RuleId.imageFormatConverts,
    title: 'Image Format Converts',
    purpose: 'Image format is converted successfully from unsupported to supported format.',
  },
  {
    id: RuleId.imageCopied,
    title: 'Image Copied',
    purpose: 'Image is copied successfully from source location.',
  },
  {
    id: RuleId.imageFormatOptimizes,
    title: 'Image Format Optimizes',
    purpose: 'Images format is converted to webp for optimal web performance.',
  },
];

export const imageRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.image],
});
