export const INTENTS = {
  navUpdate: 'navlinks.update' as const,
  navMoveUp: 'navlinks.move-up' as const,
  navMoveDown: 'navlinks.move-down' as const,
  navDelete: 'navlinks.delete' as const,
  navAdd: 'navlinks.add' as const,
  ctaSave: 'cta.save' as const,
  ctaRemove: 'cta.remove' as const,
  ctaAdd: 'cta.add' as const,
  uploadStage: 'upload.stage' as const,
  uploadComplete: 'upload.complete' as const,
  logoUpdate: 'logo.update' as const,
  logoRemove: 'logo.remove' as const,
  updateColor: 'color.update' as const,
};

type ValueOf<T> = T extends any[] ? T[number] : T[keyof T];

export type Intents = ValueOf<typeof INTENTS>;

export interface CTA {
  url: string;
  label: string;
  icon?: string;
  classes?: string;
  openInNewTab?: boolean;
}
