import { useFetcher } from 'react-router';
import { ui, useMyUser, usePingEvent, TrackEvent } from '@curvenote/scms-core';
import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

interface RequestSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RequestSiteModal({ isOpen, onClose }: RequestSiteModalProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const user = useMyUser();
  const pingEvent = usePingEvent();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    labWebsite: '',
    additionalInfo: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Populate form with user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.display_name || '',
        email: user.email || '',
      }));

      // Focus the first field after a short delay to ensure modal is fully rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    } else if (!isOpen) {
      // Reset form state when modal closes
      setIsSubmitted(false);
      setFormData({
        name: '',
        email: '',
        labWebsite: '',
        additionalInfo: '',
      });
    }
  }, [isOpen, user]);

  const isSubmitting = fetcher.state === 'submitting';

  const handleFormSubmit = () => {
    pingEvent(TrackEvent.SITE_REQUEST_COMPLETED, {
      requesterName: formData.name,
      requesterEmail: formData.email,
      hasLabWebsite: !!formData.labWebsite,
      hasAdditionalInfo: !!formData.additionalInfo,
    });
  };

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success) {
        setIsSubmitted(true);
      } else if (fetcher.data.error) {
        console.error('Submission error:', fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <ui.Dialog open={isOpen} onOpenChange={onClose}>
      <ui.DialogContent className="sm:max-w-[600px]">
        {isSubmitted ? (
          // Success state
          <div className="py-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <Check className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Thanks for your request</h2>
            <p className="mb-6 text-sm text-gray-600">
              We'll be in touch soon. Your interest helps shape the future of science communication.
            </p>
            <ui.Button onClick={onClose}>Close</ui.Button>
          </div>
        ) : (
          // Form state
          <>
            <ui.DialogHeader>
              <ui.DialogTitle>Request a Curvenote Site</ui.DialogTitle>
              <ui.DialogDescription>
                We'll review your request and get back to you soon.
              </ui.DialogDescription>
            </ui.DialogHeader>
            <fetcher.Form
              method="POST"
              className="space-y-4"
              autoComplete="off"
              onSubmit={handleFormSubmit}
            >
              <input type="hidden" name="intent" value="request-site" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ui.Label htmlFor="name">Name *</ui.Label>
                  <ui.Input
                    ref={nameInputRef}
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Your name"
                    data-lpignore="true"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <ui.Label htmlFor="email">Email *</ui.Label>
                  <ui.Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    data-lpignore="true"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <ui.Label htmlFor="labWebsite">Current Lab Website (Optional)</ui.Label>
                <ui.Input
                  id="labWebsite"
                  name="labWebsite"
                  value={formData.labWebsite}
                  onChange={(e) => handleInputChange('labWebsite', e.target.value)}
                  placeholder="https://yourlab.org"
                />
              </div>

              <div className="space-y-2">
                <ui.Label htmlFor="additionalInfo">
                  Anything you want to share with us? (Optional)
                </ui.Label>
                <ui.Textarea
                  id="additionalInfo"
                  name="additionalInfo"
                  value={formData.additionalInfo}
                  onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                  placeholder="Tell us about your lab or what excites you about connected science..."
                  rows={4}
                />
              </div>

              <ui.DialogFooter>
                <ui.Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </ui.Button>
                <ui.Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Request Site'}
                </ui.Button>
              </ui.DialogFooter>
            </fetcher.Form>
          </>
        )}
      </ui.DialogContent>
    </ui.Dialog>
  );
}
