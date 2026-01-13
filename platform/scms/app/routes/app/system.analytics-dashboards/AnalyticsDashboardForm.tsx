import { useState, useEffect } from 'react';
import { Form, useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';

interface AnalyticsDashboardFormProps {
  sites: Array<{
    id: string;
    name: string;
    title: string;
  }>;
  dashboard?: {
    id: string;
    title: string;
    description?: string | null;
    type: 'PLATFORM' | 'SITE';
    url: string;
    site_id?: string | null;
    enabled: boolean;
  };
  onCancel?: () => void;
}

export function AnalyticsDashboardForm({
  sites,
  dashboard,
  onCancel,
}: AnalyticsDashboardFormProps) {
  const [type, setType] = useState<'PLATFORM' | 'SITE'>(dashboard?.type || 'PLATFORM');

  // Handle type change - reset site IDs when switching types
  const handleTypeChange = (newType: 'PLATFORM' | 'SITE') => {
    setType(newType);
    setSiteId('');
  };
  const [title, setTitle] = useState(dashboard?.title || '');
  const [description, setDescription] = useState(dashboard?.description || '');
  const [url, setUrl] = useState(dashboard?.url || '');
  const [siteId, setSiteId] = useState(dashboard?.site_id || '');
  const [enabled, setEnabled] = useState(dashboard?.enabled ?? true);

  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === 'submitting';

  const isEditing = !!dashboard;

  // Reset form after successful creation (not editing)
  useEffect(() => {
    if (
      !isEditing &&
      fetcher.state === 'idle' &&
      fetcher.data &&
      typeof fetcher.data === 'object' &&
      'success' in fetcher.data &&
      (fetcher.data as { success: boolean }).success
    ) {
      setTitle('');
      setDescription('');
      setUrl('');
      setSiteId('');
      setEnabled(true);
      setType('PLATFORM');
    }
  }, [fetcher.state, fetcher.data, isEditing]);

  return (
    <Form method="post" className="space-y-4">
      <input type="hidden" name="intent" value={isEditing ? 'update' : 'create'} />
      {isEditing && <input type="hidden" name="id" value={dashboard.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <ui.Label htmlFor="title">Title *</ui.Label>
          <ui.Input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Analytics Dashboard Title"
          />
        </div>

        <div className="space-y-2">
          <ui.Label htmlFor="type">Type *</ui.Label>
          <ui.Select name="type" value={type} onValueChange={handleTypeChange}>
            <ui.SelectTrigger>
              <ui.SelectValue placeholder="Select dashboard type" />
            </ui.SelectTrigger>
            <ui.SelectContent>
              <ui.SelectItem value="PLATFORM">Platform</ui.SelectItem>
              <ui.SelectItem value="SITE">Site</ui.SelectItem>
            </ui.SelectContent>
          </ui.Select>
        </div>
      </div>

      <div className="space-y-2">
        <ui.Label htmlFor="description">Description</ui.Label>
        <ui.Textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of the analytics dashboard"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <ui.Label htmlFor="url">Dashboard URL *</ui.Label>
        <ui.Input
          id="url"
          name="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://analytics.example.com/dashboard"
        />
      </div>

      {type === 'SITE' && (
        <div className="space-y-2">
          <ui.Label htmlFor="site_id">Site *</ui.Label>
          <ui.Select name="site_id" value={siteId} onValueChange={setSiteId}>
            <ui.SelectTrigger>
              <ui.SelectValue placeholder="Select a site" />
            </ui.SelectTrigger>
            <ui.SelectContent>
              {sites.map((site) => (
                <ui.SelectItem key={site.id} value={site.id}>
                  {site.title} ({site.name})
                </ui.SelectItem>
              ))}
            </ui.SelectContent>
          </ui.Select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <ui.Switch
          id="enabled"
          name="enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          value={enabled.toString()}
        />
        <ui.Label htmlFor="enabled">Enabled</ui.Label>
      </div>

      <div className="flex gap-2 pt-4">
        <ui.Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Dashboard' : 'Create Dashboard'}
        </ui.Button>
        {onCancel && (
          <ui.Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </ui.Button>
        )}
      </div>
    </Form>
  );
}
