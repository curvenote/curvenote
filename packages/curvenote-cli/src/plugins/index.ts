import type { MystPlugin } from 'myst-common';
import { articlesDirective } from './directives/articles.js';
import { collectionsDirective } from './directives/collections.js';

const plugin: MystPlugin = {
  name: 'Curvenote Plugin',
  directives: [articlesDirective, collectionsDirective],
  roles: [],
  transforms: [],
};

export default plugin;
