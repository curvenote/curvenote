import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { SimpleDialog } from './ui/simple-dialog.js';
import { Button } from './ui/button.js';
import { LimitedTextarea } from './ui/limited-textarea.js';
import { Label } from './ui/label.js';
import { Input } from './ui/input.js';
import { CircleCheck } from 'lucide-react';
import { toastError } from './ui/toast.js';
import type { GeneralError } from '../backend/types.js';

interface InviteUserDialogProps {
  /**
   * Controls whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when the dialog should be closed
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Optional callback when the invitation is successfully sent
   */
  onSuccess?: () => void;
  /**
   * The title for the dialog
   */
  title?: string;
  /**
   * The description text shown below the title
   */
  description?: string;
  /**
   * The action URL to submit the form to
   */
  actionUrl?: string;
  /**
   * Success message to display after submission
   */
  successMessage?: string;
  /**
   * The platform/workspace name from branding config
   */
  platformName?: string;
  /**
   * The intent to use for the action
   */
  intent?: string;
  /**
   * Optional additional context to include in the request
   */
  context?: Record<string, string>;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * A reusable dialog component for inviting users to the workspace
 * Features:
 * - Email input (required)
 * - Optional message to include in invitation
 * - Toast notifications for success/error
 * - Success state display
 * - Configurable action URL and context
 * - Optional onSuccess callback for parent component actions
 */
export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
  title = 'Invite Someone to the Workspace',
  description = 'Send an invitation email to someone who should join the workspace.',
  actionUrl,
  successMessage = 'Invitation sent successfully. They will receive an email with instructions to join.',
  platformName = 'the workspace',
  intent = 'invite-new-user',
  context,
}: InviteUserDialogProps) {
  // Use a unique fetcher key to isolate this fetcher
  const fetcherKey = `invite-user-${actionUrl || 'default'}`;
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>({ key: fetcherKey });
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  // Use ref to track if we've already handled this success/error to prevent duplicate toasts
  const handledResponseRef = useRef<string | null>(null);
  // Store onSuccess in a ref to avoid including it in dependencies
  const onSuccessRef = useRef(onSuccess);

  // Update ref when onSuccess changes
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Handle success and error states
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      // Create a unique key for this response to prevent duplicate handling
      const responseKey = JSON.stringify(fetcher.data);

      // Skip if we've already handled this exact response
      if (handledResponseRef.current === responseKey) {
        return;
      }

      if (fetcher.data.error) {
        let errorMessage: string;
        if (typeof fetcher.data.error === 'string') {
          errorMessage = fetcher.data.error;
        } else if (
          fetcher.data.error &&
          typeof fetcher.data.error === 'object' &&
          'message' in fetcher.data.error
        ) {
          errorMessage = fetcher.data.error.message;
        } else {
          errorMessage = 'An unknown error occurred';
        }
        toastError(errorMessage);
        handledResponseRef.current = responseKey;
      } else if (fetcher.data.success) {
        setShowSuccess(true);
        setEmail('');
        setMessage('');
        handledResponseRef.current = responseKey;

        // Call onSuccess callback if provided
        if (onSuccessRef.current) {
          onSuccessRef.current();
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Reset success state and handled response ref when dialog closes
  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      setEmail('');
      setMessage('');
      handledResponseRef.current = null;
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toastError('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toastError('Please enter a valid email address');
      return;
    }

    // Don't allow submission if message limit is exceeded
    if (message.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    const formData = new FormData();
    formData.append('intent', intent);
    formData.append('email', trimmedEmail);
    formData.append('message', message.trim());

    // Add context if provided
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    fetcher.submit(formData, {
      method: 'post',
      action: actionUrl,
    });
  };

  const handleClose = () => {
    if (fetcher.state !== 'submitting') {
      onOpenChange(false);
      setShowSuccess(false);
      setEmail('');
      setMessage('');
    }
  };

  const handleSuccessClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setShowSuccess(false);
      setEmail('');
      setMessage('');
    }, 100);
  };

  if (showSuccess) {
    return (
      <SimpleDialog
        open={open}
        onOpenChange={(shouldOpen) => {
          // Prevent closing success dialog via outside click/escape
          // Only allow programmatic closing via the Close button
          if (!shouldOpen) {
            return;
          }
        }}
        footerButtons={[{ label: 'Close', onClick: handleSuccessClose }]}
      >
        <div className="flex flex-col items-center py-6">
          <CircleCheck className="w-16 h-16 mb-4 text-green-600" />
          <h2 className="text-lg font-semibold leading-none text-center">Invitation Sent</h2>
          <p className="mt-2 text-base text-center text-muted-foreground">{successMessage}</p>
        </div>
      </SimpleDialog>
    );
  }

  return (
    <SimpleDialog
      open={open}
      onOpenChange={handleClose}
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={fetcher.state === 'submitting'}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              fetcher.state === 'submitting' || !email.trim() || message.length > MAX_MESSAGE_LENGTH
            }
          >
            {fetcher.state === 'submitting' ? 'Sending...' : 'Send Invitation'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="inviteEmail" className="text-sm font-medium">
            Email Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="mt-2"
            disabled={fetcher.state === 'submitting'}
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="inviteMessage" className="text-sm font-medium">
            Personal Message (Optional)
          </Label>
          <LimitedTextarea
            id="inviteMessage"
            value={message}
            onChange={setMessage}
            placeholder={`Add a personal message to include with the invitation to join ${platformName}...`}
            className="mt-2 min-h-[100px]"
            disabled={fetcher.state === 'submitting'}
            maxLength={MAX_MESSAGE_LENGTH}
          />
        </div>
      </div>
    </SimpleDialog>
  );
}
