import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.docxRenders,
    title: 'DOCX Renders Successfully',
    purpose: 'The document renders to DOCX format without errors.',
  },
  {
    id: RuleId.jatsRenders,
    title: 'JATS Renders Successfully',
    purpose: 'The document renders to JATS format without errors.',
  },
  {
    id: RuleId.mdRenders,
    title: 'Markdown Renders Successfully',
    purpose: 'The document renders to Markdown format without errors.',
  },
  {
    id: RuleId.mecaIncludesJats,
    title: 'MECA Includes JATS',
    purpose: 'MECA bundle includes a single JATS document.',
  },
  {
    id: RuleId.mecaExportsBuilt,
    title: 'MECA Includes Manuscripts',
    purpose: 'Manuscript files (pdf, docx, etc) are built and included in MECA bundle.',
  },
  {
    id: RuleId.mecaFilesCopied,
    title: 'MECA Includes Files',
    purpose: 'Files are copied successfully to MECA bundle.',
  },
  {
    id: RuleId.pdfBuildsWithoutErrors,
    title: 'PDF Builds Without Errors',
    purpose: 'PDF generation completes without errors.',
  },
  {
    id: RuleId.pdfBuilds,
    title: 'PDF Builds Successfully',
    purpose: 'The document builds to PDF format without errors.',
  },
  {
    id: RuleId.texRenders,
    title: 'TeX Renders Successfully',
    purpose: 'The document renders to TeX format without errors.',
  },
  {
    id: RuleId.exportExtensionCorrect,
    title: 'Export Extension Correct',
    purpose: 'The exported file has the correct file extension.',
  },
  {
    id: RuleId.exportArticleExists,
    title: 'Exported Article Exists',
    purpose: 'The exported article exists as expected.',
  },
];

export const exportRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.export],
});
