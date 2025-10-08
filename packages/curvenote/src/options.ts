import { InvalidArgumentError, Option } from 'commander';

export function makeDomainOption() {
  return new Option(
    '--domain <string>',
    'Specify a custom domain for curve.space deployment',
  ).default(undefined);
}

export function makeVenueOption(
  description = 'Specify a venue to deploy to. A private deployment will be made and submitted to the venue.',
) {
  return new Option('--venue <string>', description).default(undefined);
}

export function makeKindOption() {
  return new Option('--kind <string>', 'Submit to the venue using this submission kind');
}

export function makeCollectionOption() {
  return new Option('--collection <string>', 'Submit to this collection at the venue');
}

export function makeDraftOption() {
  return new Option('--draft', 'Make an draft submission');
}

export function makeNewOption() {
  return new Option(
    '--new',
    'Start a new submission even if one already exists for the current work/venue',
  );
}

export function makeBranchOption() {
  return new Option(
    '--branch <branch>',
    'Branch to clone from git@github.com:curvenote/curvenote.git',
  ).default('main');
}

export function makeForceOption() {
  return new Option('-f, --force', 'Remove the build directory and re-install').default(false);
}

export function makeCIOption() {
  return new Option(
    '-ci, --ci', // Must have both!
    'Perform a minimal build, for use on Continuous Integration (CI)',
  ).default(false);
}

export function makeWriteTOCOption() {
  return new Option(
    '--write-toc',
    'Generate editable _toc.yml file for project if it does not exist',
  )
    .default(false)
    .implies({ writeTOC: true });
}

export function makeAddAuthorsOption() {
  return new Option(
    '--add-authors [authors]',
    'Add authors to project. Interactive (no args), ORCIDs (comma-separated), or "Name; Affiliation; Email" (comma-separated)',
  ).argParser((value) => {
    // If no value provided (just --add-authors), return true for interactive mode
    if (!value) {
      return true;
    }
    // Otherwise return the string as-is (will be comma-separated list)
    return value;
  });
}

export function makeGithubOption() {
  return new Option(
    '--github <url>',
    'Initialize project from a GitHub repository template URL',
  ).argParser((value) => {
    if (!value) {
      throw new InvalidArgumentError('GitHub URL is required');
    }
    return value;
  });
}

export function makeResumeOption() {
  return new Option(
    '--resume',
    'If a file upload fails, try to resume before raising an error.',
  ).default(false);
}

export function makeMaxSizeWebpOption(maxSizeMB = 1.5) {
  /** Sets the maxSizeWebp Option in the CLI */
  return new Option('--max-size-webp <size>', 'Max image size to convert to webp format in MB')
    .default(maxSizeMB * 1024 * 1024, `${maxSizeMB}`)
    .argParser((value) => {
      if (value == null) return undefined;
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        throw new InvalidArgumentError('Must be number');
      }
      return parsedValue * 1024 * 1024;
    });
}
