function title(opts: { title: string }) {
  return {
    name: 'title',
    type: 'input',
    message: 'What is the title of your website?',
    default: opts.title,
  };
}

function content(opts: { folderIsEmpty: boolean }) {
  const choices = [
    {
      name: 'Use the content & notebooks in this folder',
      value: 'folder',
      disabled: opts.folderIsEmpty,
    },
    {
      name: 'Start from a template repository (github)',
      value: 'github',
    },
    {
      name: 'Import from Curvenote',
      value: 'curvenote',
    },
    {
      name: 'Show me some demo content!',
      value: 'demo',
      disabled: true,
    },
  ].sort((a, b) => (a.disabled ? 1 : b.disabled ? -1 : 0));

  return {
    name: 'content',
    type: 'list',
    message: 'What content would you like to use?',
    choices,
  };
}

function nestedProjectChoice(opts: { projectPaths: string[] }) {
  const pathListString = opts.projectPaths.map((p) => `  - ${p}`).join('\n');
  return {
    name: 'action',
    type: 'list',
    message: `Found existing project config files on your path:\n${pathListString}\n\nWhat would you like to do?`,
    choices: [
      {
        name: 'Create a site containing these projects',
        value: 'site',
        short: 'Create site',
      },
      {
        name: 'Initialize a new project',
        value: 'new',
        short: 'New project',
      },
    ],
  };
}

function projectLink(opts?: { projectLink?: string }) {
  return {
    name: 'projectLink',
    message: 'Link to Curvenote project:',
    type: 'input',
    default: opts?.projectLink || 'https://curvenote.com/@templates/web',
  };
}

function githubUrl() {
  return {
    name: 'githubUrl',
    message: 'GitHub repository URL:',
    type: 'input',
    validate: (input: string) => {
      if (!input || !input.trim()) {
        return 'GitHub URL is required';
      }
      // Basic validation for GitHub URL
      if (!input.includes('github.com')) {
        return 'Please provide a valid GitHub repository URL';
      }
      return true;
    },
  };
}

function githubFolder(opts: { defaultFolder: string }) {
  return {
    name: 'githubFolder',
    message: 'Clone into folder:',
    type: 'input',
    default: opts.defaultFolder,
    validate: (input: string) => {
      if (!input || !input.trim()) {
        return 'Folder name is required';
      }
      return true;
    },
  };
}

function projectPath(path?: string) {
  return {
    name: 'projectPath',
    message: `Project will be cloned into "${path}" and existing files overwritten. Are you sure?`,
    type: 'confirm',
    default: true,
  };
}

function start() {
  return {
    name: 'start',
    message: `Would you like to start a local server now?`,
    type: 'confirm',
    default: true,
  };
}

function pull() {
  return {
    name: 'pull',
    message: 'Would you like to pull content now?',
    type: 'confirm',
    default: true,
  };
}

export default {
  title,
  content,
  nestedProjectChoice,
  projectLink,
  githubUrl,
  githubFolder,
  projectPath,
  start,
  pull,
};
