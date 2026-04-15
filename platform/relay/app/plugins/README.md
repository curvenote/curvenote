This folder contains Relay plugin loader files.

`load-plugins.ts` is generated at install time by:

- `platform/relay/scripts/generate-plugin-loader.js`

Generation source:

- `load-plugins.tpl.ts` is the template.
- The existing `loadPlugins([...])` list in the template is preserved as the base list.
- Additional extension plugins are appended after the base list.

Plugin discovery:

- Scans `extensions/plugins/*/package.json`
- Includes package names matching:
  - `check-relay-plugin-*`
  - `@scope/check-relay-plugin-*`

Do not edit `load-plugins.ts` manually; it is overwritten by generation.
