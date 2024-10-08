import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.validConfigStructure,
    title: 'Valid Config Structure',
    purpose: 'The configuration file has a valid structure.',
  },
  {
    id: RuleId.siteConfigExists,
    title: 'Site Config Exists',
    purpose: 'The site configuration file exists.',
  },
  {
    id: RuleId.projectConfigExists,
    title: 'Project Config Exists',
    purpose: 'The project configuration file exists.',
  },
  {
    id: RuleId.validSiteConfig,
    title: 'Valid Site Config',
    purpose: 'The site configuration is valid.',
  },
  {
    id: RuleId.validProjectConfig,
    title: 'Valid Project Config',
    purpose: 'The project configuration is valid.',
  },
  {
    id: RuleId.configHasNoDeprecatedFields,
    title: 'Config Has No Deprecated Fields',
    purpose: 'There are no deprecated fields in the configuration file.',
  },
  {
    id: RuleId.frontmatterIsYaml,
    title: 'Frontmatter Is YAML',
    purpose: 'The frontmatter format is YAML.',
  },
  {
    id: RuleId.validPageFrontmatter,
    title: 'Valid Page Frontmatter',
    purpose: 'The page frontmatter is valid.',
  },
  {
    id: RuleId.validFrontmatterExportList,
    title: 'Valid Export List',
    purpose: 'The frontmatter export list is valid.',
  },
];

export const frontmatterRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.frontmatter],
});
