import type { Route } from './+types/route';
import { data, useFetcher } from 'react-router';
import { useState, useEffect } from 'react';
import { withAppAdminContext, renderEmailTemplate } from '@curvenote/scms-server';
import {
  PageFrame,
  SystemAdminBadge,
  ui,
  primitives,
  getExtensionEmailTemplates,
} from '@curvenote/scms-core';
import { Send } from 'lucide-react';
import type { ResendEventType } from '@curvenote/scms-core';
import type { EmailTemplateInfo } from './registry.server';
import { getEmailTemplateRegistry } from './registry.server';
import { extensions } from '../../../extensions/client';

/**
 * Email Test Page
 *
 * This admin-only page allows system administrators to test email sending functionality.
 *
 * To use this page:
 * 1. Configure Resend API key in your app config (api.resend.apiKey)
 * 2. Set the from email address (api.resend.fromEmail)
 * 3. Ensure resend is not disabled (api.resend.disabled: false)
 *
 * The page will show a warning if Resend is not properly configured.
 */
export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Email Test - System Admin' },
    { name: 'description', content: 'Test email sending functionality' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppAdminContext(args);
  const resendConfigured = !!ctx.resend;

  // Get email templates including extension templates
  const emailTemplateRegistry = await getEmailTemplateRegistry();

  // Process email templates to prepend base URL to URL field examples
  const emailTemplates = Object.values(emailTemplateRegistry).map((template) => ({
    ...template,
    fields: template.fields.map((field) => ({
      ...field,
      example: field.type === 'url' ? ctx.asBaseUrl(field.example as string) : field.example,
    })),
  }));

  return { resendConfigured, emailTemplates };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppAdminContext(args);
  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'preview') {
    const eventType = formData.get('eventType') as ResendEventType;
    const templatePropsJson = formData.get('templateProps') as string;
    const ignoreUnsubscribe = formData.get('ignore-unsubscribe') === 'on';

    if (!eventType || !templatePropsJson) {
      return data({ error: 'Event type and template props are required' }, { status: 400 });
    }

    try {
      const templateProps = JSON.parse(templatePropsJson);

      // Parse JSON fields (e.g., publication field that expects an object)
      if (templateProps.publication && typeof templateProps.publication === 'string') {
        try {
          templateProps.publication = JSON.parse(templateProps.publication);
        } catch {
          // If JSON parsing fails, leave as string or set to undefined
          // The component will handle undefined gracefully
          templateProps.publication = undefined;
        }
      }

      // Render the email template
      const html = await renderEmailTemplate(
        eventType,
        templateProps,
        {
          asBaseUrl: (path) => ctx.asBaseUrl(path),
          branding: ctx.$config.app?.branding,
          unsubscribeUrl: ignoreUnsubscribe ? undefined : ctx.asBaseUrl('/unsubscribe?token=...'),
        },
        getExtensionEmailTemplates(extensions),
      );

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    } catch (error: any) {
      console.error('Error rendering email preview:', error);
      return data({ error: error.message || 'Failed to render email preview' }, { status: 400 });
    }
  }

  if (intent === 'send-templated') {
    const email = formData.get('email') as string;
    const eventType = formData.get('eventType') as ResendEventType;
    const subject = formData.get('subject') as string;
    const ignoreUnsubscribe = formData.get('ignore-unsubscribe') === 'on';

    if (!email || !eventType || !subject) {
      return data({ error: 'Email, event type, and subject are required' }, { status: 400 });
    }

    // Build template props from form data
    const emailTemplateRegistry = await getEmailTemplateRegistry();
    const templateInfo = emailTemplateRegistry[eventType];
    if (!templateInfo) {
      return data({ error: 'Invalid event type' }, { status: 400 });
    }

    const templateProps: Record<string, string | boolean | object | undefined> = {};
    for (const field of templateInfo.fields) {
      const value = formData.get(field.name) as string;
      if (field.type === 'boolean') {
        templateProps[field.name] = value === 'true';
      } else {
        if (!field.optional && !value) {
          return data({ error: `${field.label} is required` }, { status: 400 });
        }

        // Parse JSON for fields that expect objects (e.g., publication field)
        if (field.name === 'publication' && value) {
          try {
            templateProps[field.name] = JSON.parse(value);
          } catch (parseError) {
            return data(
              {
                error: `${field.label} must be valid JSON. Error: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
              },
              { status: 400 },
            );
          }
        } else {
          templateProps[field.name] = value ?? undefined;
        }
      }
    }

    try {
      await ctx.sendEmail(
        {
          eventType,
          to: email,
          subject,
          ignoreUnsubscribe,
          templateProps: templateProps as any,
        },
        getExtensionEmailTemplates(extensions),
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error sending templated email:', error);
      return data({ error: error.message || 'Failed to send email' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
}

export default function EmailTestPage({ loaderData }: Route.ComponentProps) {
  const { resendConfigured, emailTemplates } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const previewFetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === 'submitting';
  const success = fetcher.data && 'success' in fetcher.data ? fetcher.data.success : undefined;
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : undefined;

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [email, setEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [ignoreUnsubscribe, setIgnoreUnsubscribe] = useState<boolean>(false);

  // Initialize with first template
  useEffect(() => {
    if (emailTemplates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(emailTemplates[0]);
    }
  }, [emailTemplates, selectedTemplate]);

  // Update form data when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const newFormData: Record<string, string | boolean> = {};
      for (const field of selectedTemplate.fields) {
        // Only fill in example values for required fields
        newFormData[field.name] = !field.optional || field.type === 'boolean' ? field.example : '';
      }
      setFormData(newFormData);
      setSubject(selectedTemplate.exampleSubject);
    }
  }, [selectedTemplate]);

  const handleTemplateChange = (eventType: string) => {
    const template = emailTemplates.find((t) => t.eventType === eventType);
    setSelectedTemplate(template || null);
  };

  const handleFieldChange = (fieldName: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  // Update preview when form data changes
  useEffect(() => {
    if (selectedTemplate && Object.keys(formData).length > 0) {
      const timeoutId = setTimeout(() => {
        const formDataForPreview = new FormData();
        formDataForPreview.append('intent', 'preview');
        formDataForPreview.append('eventType', selectedTemplate.eventType);
        formDataForPreview.append('templateProps', JSON.stringify(formData));
        formDataForPreview.append('email', email);
        formDataForPreview.append('subject', subject);
        formDataForPreview.append('ignore-unsubscribe', ignoreUnsubscribe ? 'on' : 'off');
        previewFetcher.submit(formDataForPreview, { method: 'post' });
      }, 500); // Debounce
      return () => clearTimeout(timeoutId);
    }
  }, [formData, email, subject, selectedTemplate, ignoreUnsubscribe, previewFetcher]);

  // Update preview HTML when fetcher data changes
  useEffect(() => {
    if (previewFetcher.data && typeof previewFetcher.data === 'string') {
      setPreviewHtml(previewFetcher.data);
    }
  }, [previewFetcher.data]);

  return (
    <PageFrame>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Email Test</h1>
          <SystemAdminBadge />
        </div>

        {!resendConfigured && (
          <ui.SimpleAlert
            type="warning"
            message="Resend email service is not configured. Please configure the Resend API key and from email address in your configuration."
          />
        )}

        {success && <ui.SimpleAlert type="success" message="Test email sent successfully!" />}

        {error && <ui.SimpleAlert type="error" message={`Error sending email: ${error}`} />}

        <div className="grid items-stretch grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Form Section */}
          <primitives.Card className="p-6">
            <h2 className="mb-6 text-lg font-semibold">Template</h2>
            <fetcher.Form method="post" className="space-y-6">
              <input type="hidden" name="intent" value="send-templated" />
              <input type="hidden" name="eventType" value={selectedTemplate?.eventType || ''} />

              {/* Template Selection - Separated Section */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <ui.Select
                    value={selectedTemplate?.eventType || ''}
                    onValueChange={handleTemplateChange}
                    disabled={isSubmitting}
                  >
                    <ui.SelectTrigger>
                      <ui.SelectValue placeholder="Select a template" />
                    </ui.SelectTrigger>
                    <ui.SelectContent>
                      {emailTemplates.map((template) => (
                        <ui.SelectItem key={template.eventType} value={template.eventType}>
                          {template.name}
                        </ui.SelectItem>
                      ))}
                    </ui.SelectContent>
                  </ui.Select>
                </div>
                {selectedTemplate && (
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                )}
              </div>

              {/* Email Delivery Settings - Separated Section */}
              <div className="pt-6 space-y-4 border-t">
                <div>
                  <primitives.TextField
                    id="email"
                    name="email"
                    type="email"
                    label="To Email"
                    placeholder="delivered@resend.dev"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <primitives.TextField
                    id="subject"
                    name="subject"
                    type="text"
                    label="Subject"
                    placeholder={selectedTemplate?.exampleSubject}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Template Content Fields */}
              {selectedTemplate && (
                <div className="pt-6 space-y-4 border-t">
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.name}>
                      {field.type === 'textarea' ? (
                        <div>
                          <label htmlFor={field.name} className="block mb-2 text-sm font-medium">
                            {field.label}
                            {!field.optional && <span className="ml-1 text-red-500">*</span>}
                          </label>
                          <ui.Textarea
                            id={field.name}
                            name={field.name}
                            rows={4}
                            placeholder={field.example as string}
                            value={(formData[field.name] as string) || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            required={!field.optional}
                            disabled={isSubmitting}
                          />
                        </div>
                      ) : field.type === 'boolean' ? (
                        <div className="flex items-center space-x-3">
                          <ui.Checkbox
                            id={field.name}
                            name={field.name}
                            checked={(formData[field.name] as boolean) ?? false}
                            onCheckedChange={(checked) => handleFieldChange(field.name, !!checked)}
                            disabled={isSubmitting}
                          />
                          <label
                            htmlFor={field.name}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {field.label}
                            {!field.optional && <span className="ml-1 text-red-500">*</span>}
                          </label>
                        </div>
                      ) : (
                        <primitives.TextField
                          id={field.name}
                          name={field.name}
                          type={field.type}
                          label={field.label}
                          placeholder={field.example as string}
                          value={(formData[field.name] as string) || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          required={!field.optional}
                          disabled={isSubmitting}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Email Settings and Submit */}
              <div className="pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ui.Checkbox
                      id="ignore-unsubscribe"
                      name="ignore-unsubscribe"
                      checked={ignoreUnsubscribe}
                      onCheckedChange={(checked) => setIgnoreUnsubscribe(!!checked)}
                      disabled={isSubmitting}
                    />
                    <label
                      htmlFor="ignore-unsubscribe"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Send even if recipient is unsubscribed.
                    </label>
                  </div>

                  <ui.Button
                    type="submit"
                    disabled={!resendConfigured || isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? 'Sending...' : 'Send Email'}
                  </ui.Button>
                </div>
              </div>

              {/* Hidden inputs for form data */}
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="subject" value={subject} />
              {Object.entries(formData).map(([key, value]) => (
                <input
                  key={key}
                  type="hidden"
                  name={key}
                  value={typeof value === 'boolean' ? value.toString() : value}
                />
              ))}
            </fetcher.Form>
          </primitives.Card>

          {/* Preview Section */}
          <primitives.Card className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between flex-shrink-0 mb-4">
              <h2 className="text-lg font-semibold">Preview</h2>
            </div>

            {/* Email Delivery Info */}
            <div className="p-3 mb-4 space-y-2 rounded-lg bg-muted">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">To:</span>
                <span className={email ? 'text-foreground' : 'text-muted-foreground'}>
                  {email || 'No email address'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Subject:</span>
                <span className={subject ? 'text-foreground' : 'text-muted-foreground'}>
                  {subject || 'No subject'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden border rounded-lg">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border-0"
                title="Email Preview"
                style={{ minHeight: '500px' }}
              />
            </div>
          </primitives.Card>
        </div>
      </div>
    </PageFrame>
  );
}
