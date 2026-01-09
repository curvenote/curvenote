import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { SimpleDialog } from './ui/simple-dialog.js';
import { Button } from './ui/button.js';
import { LimitedTextarea } from './ui/limited-textarea.js';
import { Label } from './ui/label.js';
import { CircleCheck } from 'lucide-react';
import { toastError } from './ui/toast.js';
import type { GeneralError } from '../backend/types.js';

/**
 * Publication data structure for help requests
 */
export interface HelpRequestPublication {
  id: string;
  title?: string;
  compliant?: boolean;
  everNonCompliant?: boolean;
  dateResolved?: string;
  pmid?: string;
  pmcid?: string;
  journal?: {
    doi?: string;
    complianceIssueType?: string;
    complianceIssueStatus?: string;
  };
  preprint?: {
    doi?: string;
    complianceIssueType?: string;
    complianceIssueStatus?: string;
  };
}

interface RequestHelpDialogProps {
  /**
   * Optional publication data for publication-specific help requests
   */
  publication?: HelpRequestPublication;
  /**
   * ORCID identifier (required if not using context prop)
   */
  orcid?: string;
  /**
   * Controls whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when the dialog should be closed
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Optional callback when the request is successfully submitted
   */
  onSuccess?: () => void;
  /**
   * The prompt/description text to show in the dialog
   */
  prompt?: string;
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
   * Current page URL for context
   */
  currentPage?: string;
  /**
   * Optional intent/type of help request (e.g., 'compliance-report-request', 'general-help')
   */
  intent?: string;
  /**
   * Optional additional context to include in the request (e.g., ORCID, publication ID)
   * If provided, this will be used instead of individual props
   */
  context?: Record<string, string>;
  /**
   * If true, allows submitting the form without entering a message
   * Defaults to false (message is required)
   */
  messageOptional?: boolean;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * A reusable dialog component for requesting help from support
 * Features:
 * - Supports both publication-specific and general help requests
 * - Toast notifications for success/error
 * - Success state display
 * - Configurable action URL and context
 * - Optional onSuccess callback for parent component actions
 * - Intent-based routing support
 */
export function RequestHelpDialog({
  publication,
  orcid,
  open,
  onOpenChange,
  onSuccess,
  prompt,
  title = 'Request help from the support team',
  description = 'Sending this request will include your name and email address so we can respond to you.',
  actionUrl = '/app/compliance/help-request',
  successMessage = "Your request has been sent to the support team. We'll get back to you as soon as possible.",
  currentPage,
  intent,
  context,
  messageOptional = false,
}: RequestHelpDialogProps) {
  // Use a unique fetcher key to isolate this fetcher and prevent route revalidation issues
  const fetcherKey = `help-request-${publication?.id || 'general'}-${orcid || context?.orcid || 'unknown'}`;
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
  }>({ key: fetcherKey });
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
      setMessage('');
      handledResponseRef.current = null;
    }
  }, [open]);

  const handleSubmit = () => {
    // Don't allow submission if limit is exceeded
    if (message.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    const trimmedMessage = message.trim();
    // Only require message if messageOptional is false
    if (!messageOptional && !trimmedMessage) {
      return;
    }

    const formData = new FormData();
    // Always append message field (backend handles optional/empty messages)
    // Append empty string if message is empty but optional, otherwise append trimmed message
    formData.append('message', trimmedMessage || '');

    // Add intent if provided
    if (intent) {
      formData.append('intent', intent);
    }

    // If context is provided, use it (new API)
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        formData.append(key, value);
      });
    } else {
      // Otherwise use individual props (legacy API)
      if (orcid) {
        formData.append('orcid', orcid);
      }
    }

    // Send current page if provided
    if (currentPage) {
      formData.append('currentPage', currentPage);
    }

    // Send publication data if available
    if (publication) {
      formData.append(
        'publicationData',
        JSON.stringify({
          id: publication.id,
          title: publication.title || '',
          compliant: publication.compliant || false,
          everNonCompliant: publication.everNonCompliant || false,
          dateResolved: publication.dateResolved || '',
          pmid: publication.pmid || '',
          pmcid: publication.pmcid || '',
          journal: {
            doi: publication.journal?.doi || '',
            complianceIssueType: publication.journal?.complianceIssueType || '',
            complianceIssueStatus: publication.journal?.complianceIssueStatus || '',
          },
          preprint: {
            doi: publication.preprint?.doi || '',
            complianceIssueType: publication.preprint?.complianceIssueType || '',
            complianceIssueStatus: publication.preprint?.complianceIssueStatus || '',
          },
        }),
      );
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
      setMessage('');
    }
  };

  const handleSuccessClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setShowSuccess(false);
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
          <h2 className="text-lg font-semibold leading-none text-center">Request Sent</h2>
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
            Close (without sending)
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              fetcher.state === 'submitting' ||
              (!messageOptional && !message.trim()) ||
              message.length > MAX_MESSAGE_LENGTH
            }
          >
            {fetcher.state === 'submitting' ? 'Sending...' : 'Send'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="helpMessage" className="text-sm font-medium">
            {prompt || 'Please let us know how we can help.'}
          </Label>
          <LimitedTextarea
            id="helpMessage"
            value={message}
            onChange={setMessage}
            placeholder="Please tell us more about what you need help with..."
            className="mt-2 min-h-[120px]"
            disabled={fetcher.state === 'submitting'}
            maxLength={MAX_MESSAGE_LENGTH}
          />
        </div>
      </div>
    </SimpleDialog>
  );
}
