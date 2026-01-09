import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { CurvenoteLogo } from '@curvenote/icons';
import { ui, primitives, useRevalidate } from '@curvenote/scms-core';
import { Loader2, ExternalLinkIcon } from 'lucide-react';

interface PendingSiteCardProps {
  onCancel: () => void;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

function generateHostname(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const firstChar = letters[Math.floor(Math.random() * letters.length)];
  const remainingChars = Array.from(
    { length: 7 },
    () => alphanumeric[Math.floor(Math.random() * alphanumeric.length)],
  );
  const subdomain = firstChar + remainingChars.join('');
  return `${subdomain}.curve.space`;
}

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function PendingSiteCard({ onCancel }: PendingSiteCardProps) {
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [hostname] = useState(() => generateHostname());
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('idle');
  const fetcher = useFetcher();
  const availabilityFetcher = useFetcher({ key: 'site-name-availability' });
  const revalidate = useRevalidate();
  const cardRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const lastProcessedDataRef = useRef<any>(null);
  const wasSubmittingRef = useRef(false);
  const lastProcessedCreateResponseRef = useRef<any>(null);

  const nameRegex = /^[a-z0-9-]{3,30}$/;
  const isNameValid = nameRegex.test(name);

  const getNameError = () => {
    if (!name.trim()) return null;
    if (name.length < 3) return 'URL name too short';
    if (name.length > 30) return 'URL name too long';
    if (!/^[a-z0-9-]+$/.test(name)) return 'Lowercase letters, numbers, and hyphens only';
    if (availabilityStatus === 'taken') return 'URL name already taken';
    return null;
  };

  const nameError = getNameError();

  // Auto-fill name from title unless manually edited
  useEffect(() => {
    if (!isNameManuallyEdited) {
      setName(slugifyTitle(title));
    }
  }, [title, isNameManuallyEdited]);

  // Focus on the title input when the card is created
  useEffect(() => {
    if (cardRef.current) {
      const titleInput = cardRef.current.querySelector('input[name="title"]') as HTMLInputElement;
      if (titleInput) {
        titleInput.focus();
      }
    }
  }, []);

  // Debounced async check for name availability
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setAvailabilityStatus('idle');

    if (!name.trim() || !isNameValid) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      setAvailabilityStatus('checking');
      const formData = new FormData();
      formData.append('intent', 'check-site-name');
      formData.append('name', name);
      availabilityFetcher.submit(formData, { method: 'post' });
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [name, isNameValid]);

  // Handle availability check response
  useEffect(() => {
    if (
      availabilityStatus === 'checking' &&
      availabilityFetcher.state === 'idle' &&
      availabilityFetcher.data &&
      typeof availabilityFetcher.data === 'object' &&
      availabilityFetcher.data !== lastProcessedDataRef.current
    ) {
      lastProcessedDataRef.current = availabilityFetcher.data;
      setAvailabilityStatus(
        'available' in availabilityFetcher.data && availabilityFetcher.data.available
          ? 'available'
          : 'taken',
      );
    }
  }, [availabilityFetcher.data, availabilityFetcher.state, availabilityStatus]);

  // Handle site creation response
  useEffect(() => {
    if (
      wasSubmittingRef.current &&
      fetcher.state === 'idle' &&
      fetcher.data &&
      fetcher.data !== lastProcessedCreateResponseRef.current
    ) {
      lastProcessedCreateResponseRef.current = fetcher.data;
      wasSubmittingRef.current = false;

      // Check if the response indicates success
      if (
        fetcher.data &&
        typeof fetcher.data === 'object' &&
        'success' in fetcher.data &&
        fetcher.data.success
      ) {
        // Success - close the card and revalidate
        onCancel();
        revalidate();
      } else {
        // Error - extract and display error message
        let errorMessage = 'Failed to create site';

        if (fetcher.data && typeof fetcher.data === 'object') {
          // Handle error object format: { error: { submit: '...' } }
          if ('error' in fetcher.data && fetcher.data.error) {
            const error = fetcher.data.error;
            if (
              typeof error === 'object' &&
              'submit' in error &&
              typeof error.submit === 'string'
            ) {
              errorMessage = error.submit;
            } else if (typeof error === 'string') {
              errorMessage = error;
            } else if (
              typeof error === 'object' &&
              'message' in error &&
              typeof error.message === 'string'
            ) {
              errorMessage = error.message;
            }
          } else if ('error' in fetcher.data && typeof fetcher.data.error === 'string') {
            errorMessage = fetcher.data.error;
          }
        }

        ui.toastError(errorMessage);
        // Reset availability status to allow retry
        setAvailabilityStatus('idle');
      }
    } else if (fetcher.state === 'submitting') {
      wasSubmittingRef.current = true;
    }
  }, [fetcher.state, fetcher.data, onCancel, revalidate]);

  const handleNameChange = (value: string) => {
    setName(value);
    setIsNameManuallyEdited(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('intent', 'create-site');
    formData.append('title', title);
    formData.append('name', name);
    formData.append('hostname', hostname);
    fetcher.submit(formData, { method: 'post' });
  };

  const isSubmitting = fetcher.state === 'submitting';
  const canSubmit =
    title.trim() !== '' && name.trim() !== '' && isNameValid && availabilityStatus === 'available';

  return (
    <primitives.Card ref={cardRef} className="h-auto space-y-3 lg:p-6 lg:pb-3" lift>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-3">
          <CurvenoteLogo size={56} fill="currentColor" className="shrink-0" />
          <div className="flex-1">
            <ui.Input
              id="site-title"
              name="title"
              type="text"
              placeholder="Site Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <ui.Input
                id="site-name"
                name="name"
                type="text"
                placeholder="url-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isSubmitting}
                required
                className={`font-mono text-sm ${nameError ? 'border-red-500' : ''} ${availabilityStatus === 'checking' ? 'pr-8' : ''}`}
              />
              {availabilityStatus === 'checking' && (
                <Loader2 className="absolute w-4 h-4 -translate-y-1/2 right-2 top-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <ui.Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </ui.Button>
            <ui.Button type="submit" size="sm" disabled={!canSubmit || isSubmitting}>
              Create
            </ui.Button>
          </div>
          <div className="h-4 mt-1">
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            {!nameError && (
              <a
                href={`https://${hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs underline dark:text-white"
              >
                https://{hostname}
                <ExternalLinkIcon className="inline-block w-3 h-3 ml-1 align-middle" />
              </a>
            )}
          </div>
        </div>
      </form>
    </primitives.Card>
  );
}
