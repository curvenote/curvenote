import type { MystPlugin } from 'myst-common';
import { articlesDirective } from './directives/articles.js';
import { collectionsDirective } from './directives/collections.js';
import { anyWidget } from '@curvenote/any-widget';
import { zarrViewer } from './directives/zarr.js';
import { heroDirective } from './directives/hero.js';
import { blueskyDirective } from './directives/bluesky.js';

const plugin: MystPlugin = {
  name: 'Curvenote Plugin',
  directives: [articlesDirective, collectionsDirective, anyWidget, zarrViewer, heroDirective, blueskyDirective],
  roles: [],
  transforms: [],
};

export default plugin;
