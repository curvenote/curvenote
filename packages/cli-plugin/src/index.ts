import type { MystPlugin } from 'myst-common';
import { articlesDirective } from './directives/articles.js';
import { collectionsDirective } from './directives/collections.js';
import { anyBundle } from './directives/any/bundle.js';

const plugin: MystPlugin = {
  name: 'Curvenote Plugin',
  directives: [articlesDirective, collectionsDirective, anyBundle],
  roles: [],
  transforms: [],
};

export default plugin;
