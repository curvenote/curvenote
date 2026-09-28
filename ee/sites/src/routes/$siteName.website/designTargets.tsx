import { cn } from '@curvenote/scms-core';

/**
 * Everything in the site preview that can be clicked to jump to its field in the
 * settings panel. The preview only ever reports one of these; the route decides
 * which accordion section to open and which field to scroll to.
 */
export type DesignTarget =
  | 'title'
  | 'favicon'
  | 'logo'
  | 'logoDark'
  | 'colors.primary'
  | 'colors.secondary'
  | 'footer.logo'
  | 'footer.logoDark'
  | 'footer.tagline'
  | 'footer.social'
  | 'footer.links'
  | 'fonts.heading'
  | 'fonts.body'
  | 'fonts.small';

/** Where each target lives in the panel: the accordion item, and the field wrapper's id. */
export const DESIGN_TARGETS: Record<DesignTarget, { section: string; fieldId: string }> = {
  title: { section: 'item-title', fieldId: 'field-title' },
  favicon: { section: 'item-logos', fieldId: 'field-favicon' },
  logo: { section: 'item-logos', fieldId: 'field-logo' },
  logoDark: { section: 'item-logos', fieldId: 'field-logo-dark' },
  'colors.primary': { section: 'item-colors', fieldId: 'field-color-primary' },
  'colors.secondary': { section: 'item-colors', fieldId: 'field-color-secondary' },
  'footer.logo': { section: 'item-footer', fieldId: 'field-footer-logo' },
  'footer.logoDark': { section: 'item-footer', fieldId: 'field-footer-logo-dark' },
  'footer.tagline': { section: 'item-footer', fieldId: 'field-tagline' },
  'footer.social': { section: 'item-footer', fieldId: 'field-social-links' },
  'footer.links': { section: 'item-footer', fieldId: 'field-footer-links' },
  'fonts.heading': { section: 'item-typography', fieldId: 'field-font-heading' },
  'fonts.body': { section: 'item-typography', fieldId: 'field-font-body' },
  'fonts.small': { section: 'item-typography', fieldId: 'field-font-small' },
};

export type OnSelectTarget = (target: DesignTarget) => void;

/**
 * Wraps a region of the preview so hovering outlines it and clicking reports its
 * target. Renders a real button for keyboard access; when there is no `onSelect`
 * (the preview is being shown without an editor) it is an inert wrapper.
 *
 * The outline is drawn with `outline`, not `border`, so the region's layout does
 * not shift on hover.
 */
export function Hotspot({
  target,
  label,
  onSelect,
  className,
  style,
  children,
}: {
  target: DesignTarget;
  label: string;
  onSelect?: OnSelectTarget;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  if (!onSelect) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(target)}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-xs cursor-pointer text-left outline-sky-500 outline-offset-2 transition-[outline-color]',
        'hover:outline-2 focus-visible:outline-2',
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
}
