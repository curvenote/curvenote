import { useFetcher } from 'react-router';
import { useState, useEffect } from 'react';
import { ui, primitives } from '@curvenote/scms-core';

export function AddUserForm() {
  const fetcher = useFetcher<{
    error?: string;
    success?: boolean;
    user?: any;
  }>();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    displayName: '',
    orcidId: '',
  });

  const isSubmitting = fetcher.state === 'submitting';

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Trim all values before submission
    const trimmedData = {
      formAction: 'create-user-with-orcid',
      username: formData.username.trim(),
      email: formData.email.trim(),
      displayName: formData.displayName.trim(),
      orcidId: formData.orcidId.trim(),
    };

    fetcher.submit(trimmedData, { method: 'POST' });
  };

  // Handle response with toasters
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error);
      } else if (fetcher.data.success) {
        ui.toastSuccess('User created successfully!', {
          description: `${formData.displayName} has been added to the platform with ORCID account.`,
        });
        // Reset form on success
        setFormData({
          username: '',
          email: '',
          displayName: '',
          orcidId: '',
        });
      }
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <primitives.Card className="p-6 mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Add New User with ORCID Account</h3>
        <p className="mt-1 text-sm text-gray-600">
          Create a new user account with an associated ORCID linked account.
        </p>
      </div>

      <fetcher.Form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ui.TextField
            label="Username"
            name="username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            required
            disabled={isSubmitting}
            placeholder="e.g., john_doe"
          />

          <ui.TextField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
            disabled={isSubmitting}
            placeholder="user@example.com"
          />
        </div>

        <ui.TextField
          label="Display Name"
          name="displayName"
          value={formData.displayName}
          onChange={(e) => handleInputChange('displayName', e.target.value)}
          required
          disabled={isSubmitting}
          placeholder="John Doe"
        />

        <div>
          <ui.TextField
            label="ORCID ID"
            name="orcidId"
            value={formData.orcidId}
            onChange={(e) => handleInputChange('orcidId', e.target.value)}
            required
            disabled={isSubmitting}
            placeholder="0000-0000-0000-0000"
            pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
          />
          <p className="mt-1 text-xs text-gray-500">
            A linked ORCID account will be created for this user
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <ui.Button
            type="button"
            variant="outline"
            onClick={() =>
              setFormData({
                username: '',
                email: '',
                displayName: '',
                orcidId: '',
              })
            }
            disabled={isSubmitting}
          >
            Clear
          </ui.Button>

          <ui.StatefulButton type="submit" variant="default" busy={isSubmitting} overlayBusy>
            Create User
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </primitives.Card>
  );
}
