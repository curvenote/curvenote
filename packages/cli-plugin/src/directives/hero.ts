import { fileWarn, type DirectiveSpec, type GenericNode } from 'myst-common';

export const heroDirective: DirectiveSpec = {
  name: 'hero',
  doc: 'Create a Curvenote hero section for the page.',
  arg: {
    type: 'myst',
    doc: 'The title of the hero section.',
  },
  options: {
    kicker: {
      type: 'myst',
      doc: 'The kicker text for the hero section.',
    },
    footer: {
      type: 'myst',
      doc: 'The footer text for the hero section.',
    },
    'background-image': {
      alias: ['backgroundImage'],
      type: String,
      doc: 'The background image for the hero section.',
    },
    overlay: {
      type: String,
      doc: 'If set, the background image will be overlaid with a black or white transparent overlay to improve readability. This is a comma separated list of percentages. e.g. `100, 70, 70, 60, 50` will generate for the breakpoints `sm, md, lg, xl, 2xl`. Any breakpoint not specified will fall back to the next smallest breakpoint. Negative values will be white.',
    },
    'max-width': {
      alias: ['maxWidth', 'max-widths', 'maxWidths'],
      type: String,
      doc: 'The max width of the hero section, at various breakpoints. This is a comma separated list of percentages. e.g. `100, 70, 70, 60, 50` will generate for the breakpoints `sm, md, lg, xl, 2xl`. Any breakpoint not specified will fall back to the next smallest breakpoint.',
    },
    light: {
      type: Boolean,
      doc: 'If set, the text will be black. The default is white text on a dark background.',
    },
    class: {
      type: String,
      doc: 'Additional classes to add to the hero section.',
    },
    actions: {
      type: 'myst',
      doc: 'The actions to add to the hero section. These should be either buttons or links.',
    },
  },
  body: {
    type: 'myst',
    doc: 'The body of the hero section.',
    required: true,
  },
  run(data, vfile) {
    const {
      kicker,
      footer,
      'background-image': backgroundImage,
      overlay,
      'max-width': maxWidth,
      light,
      class: className,
      actions,
    } = data.options ?? {};
    const { arg: title, body } = data;
    const maxWidthParsed = maxWidth
      ? (maxWidth as string).split(/,|;/).map((w) => {
          const value = Number.parseInt(w.trim().replace(/%$/, ''), 10);
          if (!w.trim() || w.trim().toLowerCase() === 'null') {
            // Explicitly ignore this breakpoint
            return null;
          }
          if (w.trim() && Number.isNaN(value)) {
            fileWarn(
              vfile,
              `maxWidth must be a comma separated list of percentages. ${w} is not a valid percentage.`,
              { node: data.node },
            );
            return undefined;
          }
          if (value < 0 || value > 100) {
            fileWarn(
              vfile,
              `maxWidth must be a comma separated list of percentages. ${value} outside the range 0-100.`,
              { node: data.node },
            );
            // still fall through to the clamped value
          }
          return Math.max(0, Math.min(100, Math.round(value / 5) * 5));
        })
      : undefined;
    if (maxWidthParsed && maxWidthParsed.length > 5) {
      vfile.message(
        'maxWidth must be a comma separated list of up to 5 percentages, which are rounded to the nearest 5% and used for breakpoints in order of sm, md, lg, xl, 2xl.',
      );
    }
    const overlayParsed = overlay
      ? (overlay as string).split(/,|;/).map((o) => {
          const value = Number.parseInt(o.trim().replace(/%$/, ''), 10);
          if (!o.trim() || o.trim().toLowerCase() === 'null') {
            // Explicitly ignore this breakpoint
            return null;
          }
          if (o.trim() && Number.isNaN(value)) {
            fileWarn(
              vfile,
              `overlay must be a comma separated list of percentages. ${o} is not a valid percentage.`,
              { node: data.node },
            );
            return undefined;
          }
          if (value < -100 || value > 100) {
            fileWarn(
              vfile,
              `overlay must be a comma separated list of percentages. ${value} outside the range -100-100.`,
              { node: data.node },
            );
            // still fall through to the clamped value
          }
          return Math.max(-100, Math.min(100, Math.round(value / 10) * 10));
        })
      : undefined;
    if (maxWidthParsed && maxWidthParsed.length > 5) {
      vfile.message(
        'maxWidth must be a comma separated list of up to 5 percentages, which are rounded to the nearest 10% and used for breakpoints in order of sm, md, lg, xl, 2xl.',
      );
    }
    return [
      {
        type: 'block',
        kind: 'hero',
        class: className,
        data: {
          maxWidth: maxWidthParsed,
          overlay: overlayParsed,
          light,
        },
        children: [
          backgroundImage
            ? {
                type: 'div',
                kind: 'backgroundImage',
                children: [
                  {
                    type: 'image',
                    kind: 'placeholder',
                    url: backgroundImage,
                  },
                ],
              }
            : undefined,
          kicker
            ? {
                type: 'div',
                kind: 'kicker',
                children: kicker,
              }
            : undefined,
          title
            ? {
                type: 'div',
                kind: 'title',
                children: title,
              }
            : undefined,
          body
            ? {
                type: 'div',
                kind: 'body',
                children: body,
              }
            : undefined,
          actions
            ? {
                type: 'div',
                kind: 'actions',
                children: actions,
              }
            : undefined,
          footer
            ? {
                type: 'div',
                kind: 'footer',
                children: footer,
              }
            : undefined,
        ].filter(Boolean),
      },
    ] as GenericNode[];
  },
};
