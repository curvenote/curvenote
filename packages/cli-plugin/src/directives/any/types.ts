// TODO get this into a distributable package
export type AnyBundleDirective = {
  /** The type of the directive */
  type: 'block';
  /** The kind of the directive */
  kind: 'any:bundle';
  /** The data to pass to the model */
  data: {
    /** The ES module to import */
    esm: string;
    import: string; // legacy
    /** The JSON data to initialize the widget */
    json: Record<string, unknown>;
    /** URL to a css stylesheet to load for the widget */
    css?: string;
    styles?: string; // legacy
    /** Tailwind classes to apply to the container element */
    class?: string;
    /** A static file path, folder path or glob pattern to static files to make available to the module */
    static?: string;
  };
};
