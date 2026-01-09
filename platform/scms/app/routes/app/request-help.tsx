import { data } from 'react-router';
import type { Route } from './+types/request-help';
import { withAppContext, sanitizeUserInput } from '@curvenote/scms-server';
import { KnownResendEvents } from '@curvenote/scms-core';

export async function loader() {
  // This route only handles POST requests
  console.error('This route only handles POST requests');
  return data({}, { status: 405 });
}

export function shouldRevalidate() {
  // Prevent revalidation after help request submissions to avoid closing dialogs
  return false;
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppContext(args);

  const formData = await args.request.formData();
  const rawMessage = formData.get('message') as string;
  const currentPage = formData.get('currentPage') as string | null;

  if (!rawMessage) {
    return data({ success: false, error: 'Missing required fields' }, { status: 400 });
  }

  // Sanitize and validate message
  const message = sanitizeUserInput(rawMessage, 2000);
  if (!message.trim()) {
    return data({ success: false, error: 'Message cannot be empty' }, { status: 400 });
  }

  const supportEmail = ctx.$config.app?.branding?.supportEmail;
  if (!supportEmail) {
    console.error('Support email not configured');
    return data({ success: false, error: 'Support email not configured' }, { status: 500 });
  }

  const userName = ctx.user.display_name || 'Unknown User';
  const userEmail = ctx.user.email || 'No email provided';
  const deploymentName = ctx.$config.app?.branding?.title ?? ctx.$config.name ?? 'Curvenote SCMS';
  const subject = `${deploymentName} - Help Requested`;

  try {
    await ctx.sendEmail({
      eventType: KnownResendEvents.HELP_REQUEST,
      to: supportEmail,
      subject,
      templateProps: {
        userName,
        userEmail,
        message,
        currentPage: currentPage || undefined,
      },
      ignoreUnsubscribe: true,
    });

    return data({ success: true });
  } catch (error) {
    console.error('Failed to send help request email:', error);
    return data({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
