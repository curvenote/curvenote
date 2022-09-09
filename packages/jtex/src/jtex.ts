import fs from 'fs';
import { extname, basename, join, dirname } from 'path';
import yaml from 'js-yaml';
import nunjucks from 'nunjucks';
import type { PageFrontmatter } from '@curvenote/frontmatter';
import type { ValidationOptions } from '@curvenote/validators';
import { curvenoteDef } from './definitions';
import { downloadAndUnzipTemplate, resolveInputs, TEMPLATE_FILENAME } from './download';
import { extendJtexFrontmatter } from './frontmatter';
import type { ISession, Renderer } from './types';
import { ensureDirectoryExists, errorLogger, warningLogger } from './utils';
import {
  validateFrontmatterTemplateOptions,
  validateTemplateOptions,
  validateTemplateTagged,
  validateTemplateYml,
} from './validators';

const DO_NOT_COPY = [TEMPLATE_FILENAME, 'thumbnail.png'];
const DO_NOT_COPY_EXTS = ['.md', '.yml', '.zip'];

const TEMPLATE_YML = 'template.yml';

class JTex {
  session: ISession;
  templatePath: string;
  templateUrl: string | undefined;
  env: nunjucks.Environment;

  /**
   * JTex class for template validation and rendering
   *
   * Constructor takes a session object for logging and optional template/path.
   * Template may be a path to an existing template on disk, a URL where the zipped
   * template may be downloaded, or the name of a Curvenote template. Path is the
   * local path where the downloaded template will be saved.
   */
  constructor(session: ISession, opts?: { template?: string; path?: string }) {
    this.session = session;
    const { templatePath, templateUrl } = resolveInputs(session, opts || {});
    this.templatePath = templatePath;
    this.templateUrl = templateUrl;
    this.env = nunjucks
      .configure(this.templatePath, {
        trimBlocks: true,
        autoescape: false, // Ensures that we are not writing to HTML!
        tags: {
          blockStart: '[#',
          blockEnd: '#]',
          variableStart: '[-',
          variableEnd: '-]',
          commentStart: '%#',
          commentEnd: '#%',
        },
      })
      .addFilter('len', (array) => array.length);
  }

  getTemplateYmlPath() {
    return join(this.templatePath, TEMPLATE_YML);
  }

  getTemplateYml() {
    const templateYmlPath = this.getTemplateYmlPath();
    if (!fs.existsSync(templateYmlPath)) {
      throw new Error(`The template yml at "${templateYmlPath}" does not exist`);
    }
    const content = fs.readFileSync(templateYmlPath).toString();
    return yaml.load(content);
  }

  getValidatedTemplateYml() {
    const opts: ValidationOptions = {
      file: this.getTemplateYmlPath(),
      property: 'template',
      messages: {},
      errorLogFn: errorLogger(this.session),
    };
    const templateYml = validateTemplateYml(this.getTemplateYml(), opts);
    if (opts.messages.errors?.length || templateYml === undefined) {
      // Strictly error if template.yml is invalid
      throw new Error(`Cannot use invalid ${TEMPLATE_YML}: ${this.getTemplateYmlPath()}`);
    }
    return templateYml;
  }

  validateOptions(options: any, frontmatter: PageFrontmatter, file?: string) {
    const templateYml = this.getValidatedTemplateYml();
    const opts: ValidationOptions = {
      file,
      property: 'options',
      messages: {},
      errorLogFn: errorLogger(this.session),
      warningLogFn: warningLogger(this.session),
    };
    const validatedOptions = validateTemplateOptions(
      options,
      templateYml?.config?.options || [],
      frontmatter,
      opts,
    );
    if (validatedOptions === undefined) {
      // Pass even if there are some validation errors; only error on total failure
      throw new Error(
        `Unable to parse options for template ${this.getTemplateYmlPath()}${
          file ? ' from ' : ''
        }${file}`,
      );
    }
    return validatedOptions;
  }

  validateTagged(
    tagged: any,
    options: Record<string, any>,
    frontmatter: PageFrontmatter,
    file?: string,
  ) {
    const templateYml = this.getValidatedTemplateYml();
    const opts: ValidationOptions = {
      file,
      property: 'tagged',
      messages: {},
      errorLogFn: errorLogger(this.session),
      warningLogFn: warningLogger(this.session),
    };
    const validatedTagged = validateTemplateTagged(
      tagged,
      templateYml?.config?.tagged || [],
      options,
      frontmatter,
      opts,
    );
    if (validatedTagged === undefined) {
      // Pass even if there are some validation errors; only error on total failure
      throw new Error(
        `Unable to parse tagged values for template ${this.getTemplateYmlPath()}${
          file ? ' from ' : ''
        }${file}`,
      );
    }
    return validatedTagged;
  }

  validateFrontmatter(frontmatter: any, file?: string) {
    const templateYml = this.getValidatedTemplateYml();
    const opts: ValidationOptions = {
      file,
      property: 'frontmatter',
      messages: {},
      errorLogFn: errorLogger(this.session),
      warningLogFn: warningLogger(this.session),
    };
    const validatedFrontmatter = validateFrontmatterTemplateOptions(
      frontmatter,
      templateYml?.config?.options || [],
      opts,
    );
    if (validatedFrontmatter === undefined) {
      throw new Error(`Unable to read frontmatter${file ? ' from ' : ''}${file}`);
    }
    return validatedFrontmatter;
  }

  async ensureTemplateExistsOnPath(force?: boolean) {
    if (!force && fs.existsSync(join(this.templatePath, TEMPLATE_FILENAME))) {
      this.session.log.debug(`Template found at path: ${this.templatePath}`);
    } else if (!this.templateUrl) {
      throw new Error(
        `No template on path and no download URL to fetch from: ${this.templatePath}`,
      );
    } else {
      await downloadAndUnzipTemplate(this.session, {
        templatePath: this.templatePath,
        templateUrl: this.templateUrl,
      });
    }
  }

  render(opts: {
    contentOrPath: string;
    outputPath: string;
    frontmatter: any;
    tagged: any;
    options: any;
    sourceFile?: string;
  }) {
    if (!fs.existsSync(join(this.templatePath, TEMPLATE_FILENAME))) {
      throw new Error(
        `The template at "${join(this.templatePath, TEMPLATE_FILENAME)}" does not exist`,
      );
    }
    if (extname(opts.outputPath) !== '.tex') {
      throw new Error(`outputPath must be a ".tex" file, not "${opts.outputPath}"`);
    }
    let content: string;
    if (fs.existsSync(opts.contentOrPath)) {
      this.session.log.debug(`Reading content from ${opts.contentOrPath}`);
      content = fs.readFileSync(opts.contentOrPath).toString();
    } else {
      content = opts.contentOrPath;
    }
    const frontmatter = this.validateFrontmatter(opts.frontmatter, opts.sourceFile);
    const options = this.validateOptions(opts.options, frontmatter, opts.sourceFile);
    const tagged = this.validateTagged(opts.tagged, options, frontmatter, opts.sourceFile);
    const doc = extendJtexFrontmatter(frontmatter);
    const renderer: Renderer = {
      CONTENT: content,
      doc,
      tagged,
      options,
    };
    const rendered = this.env.render(TEMPLATE_FILENAME, renderer);
    const outputDirectory = dirname(opts.outputPath);
    ensureDirectoryExists(outputDirectory);
    this.copyTemplateFiles(dirname(opts.outputPath));
    fs.writeFileSync(opts.outputPath, `% Created with jtex v.${version}\n${rendered}`);
    fs.writeFileSync(join(outputDirectory, 'curvenote.def'), curvenoteDef);
  }

  copyTemplateFiles(outputDir: string, opts?: { force?: boolean }) {
    const dir = fs
      .readdirSync(this.templatePath)
      .map((s) => join(this.templatePath, s))
      .filter((s) => {
        if (DO_NOT_COPY.includes(basename(s))) return false;
        if (DO_NOT_COPY_EXTS.includes(extname(s))) return false;
        if (fs.lstatSync(s).isDirectory()) return false;
        return true;
      });
    dir.forEach((file) => {
      const dest = join(outputDir, basename(file));
      if (fs.existsSync(dest)) {
        if (!opts?.force) {
          this.session.log.debug(`Template files ${file} already exists, not copying.`);
          return;
        }
        fs.rmSync(dest);
      }
      fs.copyFileSync(file, dest);
    });
  }

  freeform(template: string, data: Record<string, any>) {
    return this.env.renderString(template, data);
  }
}

export default JTex;
