# @curvenote/any-widget

Extension interface and NodeRenderer following the [`any-widget`](https://github.com/manzt/anywidget) interfaces for embedding interactive widgets in MyST Markdown documents.

## Usage in MyST Markdown projects

The `any:widget` directive (also available as `any:bundle`) allows you to embed interactive widgets directly in your MyST markdown files. These widgets are ES modules that can be loaded from a URL and initialized with JSON data.



### Basic Usage

```yaml
# myst.yml
project:
  plugins:
    - any-widget.mjs
```
If you are using the Curvenote CLI then you can omit the step above as the directive is already included.

To include your widget, provide a reachable URL to the JS module, and optional css file.

````markdown
:::{any:widget} https://example.com/widget.mjs
:css: https://example.com/widget-styles.css
:class: border rounded p-4
{
  "value": 42,
  "name": "My Widget"
}
:::
````

Or do the same using the `any:bundle` alias.

### Directive Options

- `class`: Tailwind CSS classes to apply to the container element
- `css` (or `styles`, legacy): URL to a CSS stylesheet to load for the widget
- `static`: URL, File path, folder path, or glob pattern for static files to make available to the module

### Example: Counter Widget

This example demonstrates how to create and embed an interactive counter widget in your MyST markdown, based on the [anywidget counter example](https://anywidget.dev/en/notebooks/counter/).

#### 1. Create the Widget JavaScript File

Create a file `counter.mjs` that exports a widget module, in this case we are only exporting a `render()` function:

```javascript
// counter.mjs
function render({ model, el }) {
  let count = () => model.get("value");
  let btn = document.createElement("button");
  btn.classList.add("counter-button");
  btn.innerHTML = `count is ${count()}`;
  
  btn.addEventListener("click", () => {
    model.set("value", count() + 1);
    model.save_changes();
  });
  
  model.on("change:value", () => {
    btn.innerHTML = `count is ${count()}`;
  });
  
  el.appendChild(btn);
}

export default { render };
```

#### 2. Create the CSS File

Create a file `counter.css` with styles for the widget:

```css
/* counter.css */
.counter-button {
  background-image: linear-gradient(to right, #a1c4fd, #c2e9fb);
  border: 0;
  border-radius: 10px;
  padding: 10px 50px;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.1s;
}

.counter-button:hover {
  transform: scale(1.05);
}

.counter-button:active {
  transform: scale(0.95);
}
```

#### 3. Use the Widget in MyST Markdown

In your MyST markdown file, use the `any:widget` directive:

````markdown
:css: https://example.com/counter.css
:class: my-4
:::{any:widget} https://example.com/counter.mjs
{
  "value": 0
}
:::
````

The widget will automatically:
- Load the JavaScript module from the URL
- Initialize with the JSON data (`{"value": 0}`)
- Apply the CSS stylesheet
- Handle user interactions and update the display

#### How the Widget Model Works

The widget uses the `model` object as the source of truth:
- `model.get("value")` retrieves the current value
- not yet implemented
  - `model.set("value", newValue)` updates the value
  - `model.on("change:value", callback)` listens for value changes
  - `model.save_changes()` syncs changes back to the model

This ensures the widget state stays synchronized whether updates come from user interactions or programmatic changes.

## Usage for developers and theme builders

This package provides two main entry points for different use cases:

1. **Directive** (Node/CLI context): A MyST directive specification for parsing `any:widget` and `any:bundle` directives in markdown
2. **React Renderers** (React context): React components for rendering AnyWidget components in the browser

### Installation

```bash
npm install @curvenote/any-widget
```

### Use Case 1: Adding the Directive to a CLI or Custom Build Pipeline

If you're building a CLI tool or custom build pipeline that processes MyST markdown, you'll want to add the directive to your processing pipeline.

**Import the directive:**

```typescript
import { anyWidget } from '@curvenote/any-widget';
import type { MystPlugin } from 'myst-common';

const plugin: MystPlugin = {
  name: 'My Plugin',
  directives: [anyWidget],
  // ... other plugin configuration
};
```

**Or use the bundled plugin:**

If you prefer a pre-bundled version, you can use the plugin bundle:

```typescript
import anyWidgetPlugin from '@curvenote/any-widget/dist/plugin/any-widget.mjs';

const plugin: MystPlugin = {
  name: 'My Plugin',
  directives: [anyWidgetPlugin.anyWidget],
  // ... other plugin configuration
};
```

The directive will parse `any:widget` and `any:bundle` directives in your markdown and convert them into AST nodes that can be rendered.

### Use Case 2: Adding Renderers to a Theme

If you're building a theme or React application that renders MyST documents, you'll need to add the React renderers to display the widgets.

**Import the renderers:**

```typescript
import { ANY_RENDERERS } from '@curvenote/any-widget/react';
import { Document } from '@myst-theme/providers';

function MyDocument({ ast }) {
  return (
    <Document 
      ast={ast}
      renderers={{
        ...defaultRenderers,
        ...ANY_RENDERERS
      }}
    />
  );
}
```

The renderers will automatically:
- Load the ES module from the specified URL
- Initialize the widget with the provided JSON data
- Handle CSS stylesheets (with shadow DOM support)
- Display error messages if the widget fails to load

### TypeScript Types

The package exports TypeScript types for type safety:

```typescript
import type { AnyWidgetDirective } from '@curvenote/any-widget';
// or
import type { AnyWidgetDirective } from '@curvenote/any-widget/react';
```

### Package Exports

The package provides the following exports:

- **Main export** (`@curvenote/any-widget`): The directive for Node/CLI usage
- **React export** (`@curvenote/any-widget/react`): The React renderers for theme usage
- **Plugin bundle** (`@curvenote/any-widget/dist/plugin/any-widget.mjs`): Pre-bundled directive plugin

## Development

### Prerequisites

- Node.js >= 14
- npm >= 7

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

This will:
- Compile TypeScript to the `dist` directory (for library exports)
- Bundle the directive plugin to `dist/plugin/any-widget.mjs`

### Type Checking

```bash
npm run compile
```

### Testing

```bash
npm test
```

Or in watch mode:

```bash
npm run test:watch
```

### Project Structure

```
src/
  ├── index.ts          # Main entry point (directive exports)
  ├── directive/         # Directive implementation
  ├── renderer/          # React renderer implementation
  └── types.ts           # TypeScript type definitions
```

### Contributing

This package is part of the Curvenote monorepo. See the main repository for contribution guidelines.

## License

MIT
