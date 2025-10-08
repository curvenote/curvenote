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

function projectLink(opts?: { projectLink?: string }) {
  return {
    name: 'projectLink',
    message: 'Link to Curvenote project:',
    type: 'input',
    default: opts?.projectLink || 'https://curvenote.com/@templates/web',
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
  projectLink,
  projectPath,
  start,
  pull,
};
