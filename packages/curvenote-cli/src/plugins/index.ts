import type { MystPlugin } from 'myst-common';
import { articlesDirective } from './articles.js';

const plugin: MystPlugin = {
  name: 'Curvenote Plugin',
  directives: [articlesDirective],
  roles: [],
  transforms: [],
};

export default plugin;
