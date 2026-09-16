import type { SocialLink, SocialSite } from '@curvenote/common';
import { summarizeIssues } from './FooterLinksField.js';
import { ui } from '@curvenote/scms-core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  BlueskyIcon,
  DiscordIcon,
  DiscourseIcon,
  EmailIcon,
  GithubIcon,
  LinkedinIcon,
  MastodonIcon,
  SlackIcon,
  WebsiteIcon,
  XIcon,
  YoutubeIcon,
} from '@scienceicons/react/24/solid';
import { useEffect, useState } from 'react';
import { uuidv7 } from 'uuidv7';

const SOCIAL_ICONS: Record<string, typeof WebsiteIcon> = {
  bluesky: BlueskyIcon,
  twitter: XIcon,
  mastodon: MastodonIcon,
  linkedin: LinkedinIcon,
  github: GithubIcon,
  slack: SlackIcon,
  email: EmailIcon,
  discord: DiscordIcon,
  website: WebsiteIcon,
  youtube: YoutubeIcon,
  discourse: DiscourseIcon,
};

/** Icon for a social link kind, falling back to the generic website globe. */
export function SocialIcon({
  kind,
  className,
  style,
}: {
  kind: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = SOCIAL_ICONS[kind] ?? WebsiteIcon;
  return <Icon className={className} style={style} />;
}

/** Hosts we can identify, in the order they are matched. */
const HOST_PATTERNS: { kind: SocialSite; label: string; test: (host: string) => boolean }[] = [
  { kind: 'bluesky', label: 'Bluesky', test: (h) => h === 'bsky.app' || h.endsWith('.bsky.app') },
  {
    kind: 'twitter',
    label: 'X (Twitter)',
    test: (h) => h === 'twitter.com' || h === 'x.com' || h.endsWith('.twitter.com'),
  },
  { kind: 'linkedin', label: 'LinkedIn', test: (h) => h.endsWith('linkedin.com') },
  { kind: 'github', label: 'GitHub', test: (h) => h === 'github.com' || h.endsWith('.github.com') },
  {
    kind: 'youtube',
    label: 'YouTube',
    test: (h) => h.endsWith('youtube.com') || h === 'youtu.be',
  },
  { kind: 'slack', label: 'Slack', test: (h) => h.endsWith('slack.com') },
  {
    kind: 'discord',
    label: 'Discord',
    test: (h) => h === 'discord.gg' || h.endsWith('discord.com'),
  },
  { kind: 'discourse', label: 'Discourse', test: (h) => h.includes('discourse') },
  {
    kind: 'mastodon',
    label: 'Mastodon',
    test: (h) =>
      h.includes('mastodon') ||
      h.includes('mstdn') ||
      ['mas.to', 'hachyderm.io', 'fosstodon.org', 'scholar.social', 'sciences.social'].includes(h),
  },
];

/** Shown when a link cannot be identified, so the icon falls back to a globe. */
export const UNRECOGNIZED_SOCIAL_MESSAGE = (supported: string) =>
  `Unrecognized link — it will show a generic website icon. We support ${supported}.`;

/** Human-readable list of what {@link detectSocialKind} can identify. */
export const SUPPORTED_SOCIAL_TEXT = `${HOST_PATTERNS.map(({ label }) => label).join(', ')} and mailto: links`;

/**
 * Work out which social site a URL points at, so the footer can pick an icon.
 * Returns undefined when the link is not a URL we recognise.
 */
export function detectSocialKind(url: string): SocialSite | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase().startsWith('mailto:')) return 'email';
  let host: string;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
  return HOST_PATTERNS.find(({ test }) => test(host))?.kind;
}

type Row = { id: string; url: string };

const toRows = (links: SocialLink[]) => links.map((link) => ({ id: uuidv7(), url: link.url }));

/** Every row is emitted, blanks included, so they can be flagged rather than dropped. */
const toLinks = (rows: Row[]): SocialLink[] =>
  rows.map((row) => ({ kind: detectSocialKind(row.url) ?? 'website', url: row.url.trim() }));

/** What is wrong with the social links, phrased for the reader; undefined when fine. */
export function socialLinksError(links: SocialLink[]): string | undefined {
  const issues = links
    .map((link, index) => (link.url.trim() ? null : `Social link ${index + 1} needs a link`))
    .filter((issue): issue is string => !!issue);
  return summarizeIssues(issues);
}

export function SocialLinksField({
  links,
  onChange,
  disabled,
}: {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(links));
  const [newRowId, setNewRowId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Re-seed when the value is replaced from outside, e.g. Reset
  const signature = links.map((link) => link.url).join('\n');
  useEffect(() => {
    setRows((current) => {
      const currentSignature = current.map((row) => row.url.trim()).join('\n');
      return currentSignature === signature ? current : toRows(links);
    });
    // Keyed on the signature: edits from this component already match it, so only an
    // outside change (Reset, new loader data) rebuilds the rows and their drag ids
  }, [signature, links]);

  const applyRows = (next: Row[]) => {
    setRows(next);
    onChange(toLinks(next));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => row.id === active.id);
    const newIndex = rows.findIndex((row) => row.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...rows];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    applyRows(next);
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={rows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
          disabled={disabled}
        >
          <div className="space-y-2">
            {rows.map((row) => (
              <SocialLinkRow
                key={row.id}
                row={row}
                disabled={disabled}
                autoFocus={row.id === newRowId}
                onChange={(url) =>
                  applyRows(rows.map((r) => (r.id === row.id ? { ...r, url } : r)))
                }
                onRemove={() => applyRows(rows.filter((r) => r.id !== row.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-end">
        <ui.Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const id = uuidv7();
            applyRows([...rows, { id, url: '' }]);
            setNewRowId(id);
          }}
        >
          <Plus className="w-3 h-3" />
          Add link
        </ui.Button>
      </div>
    </div>
  );
}

function SocialLinkRow({
  row,
  disabled,
  autoFocus,
  onChange,
  onRemove,
}: {
  row: Row;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (url: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: row.id });
  // A row added in this session stays quiet until it has been left alone once
  const [touched, setTouched] = useState(!autoFocus);
  const kind = detectSocialKind(row.url);
  const empty = !row.url.trim();
  const unknown = !empty && !kind;
  const showEmpty = touched && empty;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          type="button"
          disabled={disabled}
          className="p-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
        {unknown ? (
          <ui.SimpleTooltip
            title={UNRECOGNIZED_SOCIAL_MESSAGE(SUPPORTED_SOCIAL_TEXT)}
            className="max-w-xs text-left"
          >
            <span
              className="flex shrink-0"
              role="img"
              aria-label={showEmpty ? 'Missing link' : 'Unrecognized link'}
            >
              <SocialIcon kind="website" className="w-4 h-4 text-red-500" />
            </span>
          </ui.SimpleTooltip>
        ) : (
          <SocialIcon kind={kind ?? 'website'} className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}
        <ui.Input
          value={row.url}
          autoFocus={autoFocus}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://github.com/your-org"
          disabled={disabled}
          className="flex-1 min-w-0"
          aria-invalid={showEmpty}
        />
        <ui.SimpleTooltip title="Remove Link">
          <ui.Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            onClick={onRemove}
            aria-label="Remove link"
            className="shrink-0 text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </ui.Button>
        </ui.SimpleTooltip>
      </div>
    </div>
  );
}
