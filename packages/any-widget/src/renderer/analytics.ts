import type { AnalyticsCaptureFn } from '@curvenote/theme-ui';
import type { AnyWidgetDirective } from '../types.js';

export type AnywidgetKind = 'myst_anywidget' | 'any_widget' | 'any_bundle';

export type AnywidgetIdentity = {
  moduleUrl?: string;
  nodeKey?: string;
  widgetKind: AnywidgetKind;
};

export function captureAnywidgetClicked(capture: AnalyticsCaptureFn, identity: AnywidgetIdentity) {
  capture('content_anywidget_clicked', {
    surface: 'content',
    moduleUrl: identity.moduleUrl,
    nodeKey: identity.nodeKey,
    widgetKind: identity.widgetKind,
  });
}

export function getAnywidgetIdentity(
  node: AnyWidgetDirective & { key?: string },
): AnywidgetIdentity {
  const moduleUrl = node.data.esm ?? node.data.import;
  const widgetKind: AnywidgetKind = node.kind === 'any:bundle' ? 'any_bundle' : 'any_widget';

  return {
    moduleUrl,
    nodeKey: node.key,
    widgetKind,
  };
}
