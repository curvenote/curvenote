import type { MystPlugin } from 'myst-common';
import { articlesDirective } from './directives/articles.js';
import { collectionsDirective } from './directives/collections.js';
import { anyBundle } from './directives/any/bundle.js';
import { zarrViewer } from './directives/any/zarr.js';

const plugin: MystPlugin = {
  name: 'Curvenote Plugin',
  directives: [articlesDirective, collectionsDirective, anyBundle, zarrViewer],
  roles: [],
  transforms: [],
};

export default plugin;
