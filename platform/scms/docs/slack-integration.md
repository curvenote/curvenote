# Slack Integration

This document describes the Slack integration feature for the Curvenote Journals platform, which provides real-time notifications for important system events.

## Overview

The Slack integration allows the Journals platform to send structured notifications to Slack channels when specific events occur. Each notification includes:

- **Event Type**: A clear identifier for the type of event
- **Human-readable Message**: A descriptive message about what happened
- **Structured Metadata**: Type-specific data relevant to the event
- **Timestamp**: When the event occurred
- **User Information**: Details about the user who triggered the event (when applicable)

## Configuration

### App Config Schema

The Slack integration is configured through the app-config schema under `api.slack`:

```yaml
api:
  slack:
    disabled: false
    webhookUrl: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `disabled` | boolean | No | `false` | Whether Slack notifications are disabled |
| `webhookUrl` | string | Yes* | - | Slack webhook URL for sending notifications |

*Required when `disabled` is `false`

## Usage

### Basic Usage

The Slack integration is available through the application context:

```typescript
// Send Slack notification using context
await ctx.sendSlackNotification({
  eventType: SlackEventType.USER_TOKEN_CREATED,
  message: 'New API token created by user John Doe',
  user: {
    id: 'user123',
    email: 'john@example.com',
  },
  metadata: {
    tokenId: 'token456',
    tokenDescription: 'API access token',
    expiry: 'NEVER',
  },
});
```

### Message Structure

```typescript
interface SlackMessage {
  eventType: SlackEventType;           // Event identifier from the enum
  message: string;                     // Human-readable message
  user?: {                             // Optional user information
    id?: string;
    email?: string | null;
  };
  color?: 'good' | 'warning' | 'danger'; // Optional color for the notification
  metadata?: Record<string, any>;      // Optional structured data
}
```

## Available Events

The following events are currently implemented and available:

### User Events

- **`USER_CREATED`**: Triggered when a new user is created
- **`USER_TOKEN_CREATED`**: Triggered when a user creates a new API token
- **`USER_TOKEN_DELETED`**: Triggered when a user deletes an API token

### Site Events

- **`SITE_CREATED`**: Triggered when a new site is created
- **`SITE_ROLE_GRANTED`**: Triggered when a role is granted to a user on a site
- **`SITE_ROLE_REVOKED`**: Triggered when a role is revoked from a user on a site

### Submission Events

- **`SUBMISSION_VERSION_CREATED`**: Triggered when a new submission version is created
- **`SUBMISSION_STATUS_CHANGED`**: Triggered when a submission's status changes

## Adding New Events

To add notifications for new events:

1. **Add Event Type**: Add a new entry to the `SlackEventType` enum in `app/backend/services/slack.server.ts`

2. **Create the Message**: Write a clear, human-readable message

3. **Include User Info**: Add user information when the event is triggered by a user action

4. **Define Metadata**: Include relevant structured data

5. **Integrate**: Add the notification call to the appropriate action/function

### Example: Adding a New Event Type

```typescript
// 1. Add to SlackEventType enum
export enum SlackEventType {
  // ... existing events
  SUBMISSION_PUBLISHED = 'SUBMISSION_PUBLISHED',
}

// 2. Use in your code
await ctx.sendSlackNotification({
  eventType: SlackEventType.SUBMISSION_PUBLISHED,
  message: `Submission "${submission.title}" published to ${site.name}`,
  user: {
    id: user.id,
    email: user.email,
  },
  metadata: {
    submissionId: submission.id,
    submissionTitle: submission.title,
    siteName: site.name,
    publishedAt: new Date().toISOString(),
  },
  color: 'good',
});
```

## Error Handling

The Slack integration includes robust error handling:

- **Disabled/No Config**: Gracefully skips sending when disabled or not configured
- **Network Errors**: Logs errors but doesn't interrupt application flow
- **Invalid Responses**: Logs HTTP errors for debugging
- **Missing Webhook**: Prevents sending when webhook URL is not provided

## Security Considerations

- **Webhook URLs**: Store webhook URLs as secrets in your configuration
- **Sensitive Data**: Be careful not to include sensitive information in metadata
- **Rate Limiting**: Slack has rate limits; consider batching if sending many notifications
- **Channel Access**: Ensure the webhook has access to the specified channels

## Troubleshooting

### Common Issues

1. **Notifications not sending**
   - Check that `disabled` is set to `false` (or not set at all)
   - Verify the webhook URL is correct and accessible
   - Check application logs for error messages

2. **Messages not appearing in channel**
   - Verify the webhook has permission to post to the channel
   - Check if the channel exists and is accessible

3. **Malformed messages**
   - Review the metadata structure
   - Ensure all required fields are provided
   - Check for special characters that might break JSON formatting

### Debugging

Enable debug logging by checking the console output for:
- "Slack webhook URL not configured"
- "Slack notifications disabled"
- "Slack notification sent successfully"
- "Failed to send Slack notification: [status] [statusText]"
- "Error sending Slack notification: [error]"

## Message Format

Slack notifications are sent as rich messages with:

- **Text**: The main message with environment prefix (DEV/PROD)
- **Color-coded attachments**: Based on the event type and severity
- **Structured fields**: Event type, timestamp, user info, and metadata
- **Automatic formatting**: Metadata keys are automatically formatted for readability
