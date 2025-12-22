import type { ClientExtension, ExtensionEmailTemplate } from './types.js';

export function getExtensionEmailTemplates(
  extensions: ClientExtension[],
): ExtensionEmailTemplate[] {
  const templates: ExtensionEmailTemplate[] = [];

  for (const ext of extensions) {
    if (ext.getEmailTemplates) {
      const extTemplates = ext.getEmailTemplates();
      templates.push(...extTemplates);
    }
  }

  return templates;
}

export function registerExtensionEmailTemplates(
  extensionTemplates: ExtensionEmailTemplate[],
  baseTemplates: Record<string, any>,
): Record<string, any> {
  const allTemplates = { ...baseTemplates };

  for (const template of extensionTemplates) {
    allTemplates[template.eventType] = template.component;
  }

  return allTemplates;
}
