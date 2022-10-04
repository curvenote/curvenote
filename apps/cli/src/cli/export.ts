import { Command, Option } from 'commander';
import {
  buildPdfOnly,
  exportContent,
  oxaLinkToTex,
  oxaLinkToJupyterBook,
  oxaLinkToMarkdown,
  oxaLinkToNotebook,
  oxaLinkToPdf,
  oxaLinkToWord,
} from '../export';
import { makeCleanOption, makeZipOption } from './options';
import { clirun } from './utils';

function makeImageOption() {
  return new Option('-i, --images <images>', 'Change the path to save the images to').default(
    'images',
  );
}

function makeDisableTemplateOption() {
  return new Option(
    '--disable-template',
    'Export raw latex content with no template applied',
  ).default(false);
}

function makeTemplateOption() {
  return new Option('-t, --template <name>', 'Specify a template to apply during export');
}

function makeTemplateOptionsOption() {
  return new Option(
    '-o, --options <name>',
    'Specify a `yaml` file containing optional data for the template',
  );
}

function makeConverterOption() {
  return new Option(
    '-c, --converter <name>',
    'Specify which converter to use for SVG processing (inkscape, imagemagick)',
  ).default('inkscape');
}

function makeWordExportCLI(program: Command) {
  const command = new Command('docx')
    .alias('word')
    .description('Export a Microsoft Word document from a Curvenote link')
    .argument('<article>', 'A link to the Curvenote article (e.g. OXA Link or API link)')
    .argument('[output]', 'The document filename to export to', '')
    .addOption(makeCleanOption())
    .action(clirun(oxaLinkToWord, { program }, 3));
  return command;
}

function makeMarkdownExportCLI(program: Command) {
  const command = new Command('markdown')
    .alias('md')
    .description('Export a markdown file from a Curvenote link')
    .argument('<article>', 'A link to the Curvenote article (e.g. OXA Link or API link)')
    .argument('[output]', 'The document filename to export to', 'article.md')
    .addOption(makeImageOption())
    .action(clirun(oxaLinkToMarkdown, { program }));
  return command;
}

function makeTexExportCLI(program: Command) {
  const command = new Command('latex')
    .alias('tex')
    .description('Export a tex file from a local markdown/notebook file or a Curvenote link')
    .argument(
      '<article>',
      'A local file or link to the Curvenote article (e.g. OXA Link or API link)',
    )
    .argument('[output]', 'The document filename to export to', '')
    .addOption(makeImageOption())
    .addOption(makeDisableTemplateOption())
    .addOption(makeTemplateOption())
    .addOption(makeCleanOption())
    .addOption(makeZipOption())
    .addOption(makeTemplateOptionsOption())
    .addOption(makeConverterOption())
    .action(clirun(oxaLinkToTex, { program }, 3));
  return command;
}

function makePdfExportCLI(program: Command) {
  const command = new Command('pdf')
    .description('Export a pdf file from a local markdown/notebook file or a Curvenote link')
    .argument(
      '<article>',
      'A local file or link to the Curvenote article (e.g. OXA Link or API link)',
    )
    .argument('[output]', 'The document filename to export to', '')
    .addOption(makeDisableTemplateOption())
    .addOption(makeTemplateOption())
    .addOption(makeCleanOption())
    .addOption(makeTemplateOptionsOption())
    .addOption(makeConverterOption())
    .action(clirun(oxaLinkToPdf, { program }, 3));
  return command;
}

function makePdfBuildCLI(program: Command) {
  const command = new Command('pdf:build')
    .description('Build a pdf given a tex file')
    .argument('[output]', 'A path to the tex file to build')
    .action(clirun(buildPdfOnly, { program }));
  return command;
}

function makeJupyterNotebookExportCLI(program: Command) {
  const command = new Command('notebook')
    .alias('ipynb')
    .alias('nb')
    .description('Export a jupyter-book project from a Curvenote link')
    .argument('<notebook>', 'A link to the Jupyter Notebook (e.g. OXA Link or API link)')
    .argument('[output]', 'The document filename to export to', 'notebook.ipynb')
    .action(clirun(oxaLinkToNotebook, { program }));
  return command;
}

function makeJupyterBookExportCLI(program: Command) {
  const command = new Command('jupyter-book')
    .alias('jb')
    .description('Export a jupyter-book project from a Curvenote link')
    .argument('<project>', 'A link to the Curvenote project (e.g. OXA Link or projectId)')
    .action(clirun(oxaLinkToJupyterBook, { program }));
  return command;
}

// TODO naming
function makeMultiExportCLI(program: Command) {
  const command = new Command('multi')
    .description('Export multiple targets from Curvenote via local configuraton file')
    .action(clirun(exportContent, { program }));
  return command;
}

export function addExportCLI(program: Command) {
  const command = new Command('export').description(
    'Export a Curvenote document to different formats',
  );
  command.addCommand(makeWordExportCLI(program));
  command.addCommand(makeMarkdownExportCLI(program));
  command.addCommand(makeTexExportCLI(program));
  command.addCommand(makePdfExportCLI(program));
  command.addCommand(makePdfBuildCLI(program));
  command.addCommand(makeJupyterNotebookExportCLI(program));
  command.addCommand(makeJupyterBookExportCLI(program));
  command.addCommand(makeMultiExportCLI(program));
  program.addCommand(command);
}
