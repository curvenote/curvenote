import type { MystPlugin } from 'myst-common';
import { articlesDirective } from './directives/articles.js';
import { collectionsDirective } from './directives/collections.js';
import { anyWidget } from '@curvenote/any-widget';
import { zarrViewer } from './directives/zarr.js';

const plugin: MystPlugin = {
  name: 'Curvenote Plugin',
  directives: [articlesDirective, collectionsDirective, anyWidget, zarrViewer],
  roles: [],
  transforms: [],
};

export default plugin;
