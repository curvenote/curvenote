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
import { GripVertical, Plus, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { uuidv7 } from 'uuidv7';
import type {
  RedirectRule,
  RedirectSpec,
  RedirectStatus,
  RedirectTarget,
  ThemeRedirectsConfig,
} from '../../themeConfig/types.js';
import { GROUP_LABELS, patternBindings, type RedirectGroup } from '../../themeConfig/validate.js';

/*
 * Editor for `theme_config.redirects`. Holds its own row state (with stable ids for drag and
 * focus) and reports a `ThemeRedirectsConfig` on every change, blanks included, so the route
 * can validate what is on screen rather than a cleaned-up copy.
 */

/** Only these two; the theme's 307/308 (method-preserving) are deliberately not offered. */
const STATUSES: { value: RedirectStatus; label: string; hint: string }[] = [
  { value: 302, label: '302 Temporary', hint: 'The default. Browsers check again next time.' },
  {
    value: 301,
    label: '301 Permanent',
    hint: 'Browsers cache this — use it only when the old address will never come back.',
  },
];

type Spec = { to: string; status: RedirectStatus; forwardQuery: boolean };
type Rule = Spec & { id: string; from: string };
type Group = Spec & { enabled: boolean };

const DEFAULT_SPEC: Spec = { to: '', status: 302, forwardQuery: true };

function fromTarget(target: RedirectTarget | undefined): Group {
  if (target === undefined) return { ...DEFAULT_SPEC, enabled: false };
  if (typeof target === 'string') return { ...DEFAULT_SPEC, to: target, enabled: true };
  return {
    to: target.to ?? '',
    status: target.status ?? 302,
    forwardQuery: target.forward_query !== false,
    enabled: true,
  };
}

/** A target with default status and query is saved as the bare string the theme also accepts. */
function toTarget(group: Group): RedirectTarget | undefined {
  if (!group.enabled) return undefined;
  const to = group.to.trim();
  if (group.status === 302 && group.forwardQuery) return to;
  const spec: RedirectSpec = { to };
  if (group.status !== 302) spec.status = group.status;
  if (!group.forwardQuery) spec.forward_query = false;
  return spec;
}

function fromRules(rules: RedirectRule[] | undefined): Rule[] {
  return (rules ?? []).map((rule) => ({
    id: uuidv7(),
    from: rule.from ?? '',
    to: rule.to ?? '',
    status: rule.status ?? 302,
    forwardQuery: rule.forward_query !== false,
  }));
}

function toRules(rules: Rule[]): RedirectRule[] {
  return rules.map((rule) => {
    const out: RedirectRule = { from: rule.from.trim(), to: rule.to.trim() };
    if (rule.status !== 302) out.status = rule.status;
    if (!rule.forwardQuery) out.forward_query = false;
    return out;
  });
}

export type RedirectsState = { groups: Record<RedirectGroup, Group>; rules: Rule[] };

export function stateFromConfig(config: ThemeRedirectsConfig | undefined): RedirectsState {
  return {
    groups: {
      $landing: fromTarget(config?.$landing),
      $info: fromTarget(config?.$info),
      $notFound: fromTarget(config?.$notFound),
    },
    rules: fromRules(config?.rules),
  };
}

/** The config as the theme reads it; `undefined` when nothing is configured at all. */
export function configFromState(state: RedirectsState): ThemeRedirectsConfig | undefined {
  const config: ThemeRedirectsConfig = {};
  if (state.rules.length) config.rules = toRules(state.rules);
  (Object.keys(GROUP_LABELS) as RedirectGroup[]).forEach((group) => {
    const target = toTarget(state.groups[group]);
    if (target !== undefined) config[group] = target;
  });
  return Object.keys(config).length ? config : undefined;
}

const GROUP_HELP: Record<RedirectGroup, { pattern: string; help: string }> = {
  $landing: { pattern: '/', help: 'The site home page.' },
  $info: {
    pattern: '/:slug',
    help: 'Every single-segment page such as /about or /contact. Use :slug in the destination to keep the page name.',
  },
  $notFound: {
    pattern: 'anything that would 404',
    help: 'Unknown paths and missing content. Article pages are never included, so a mistyped DOI still shows an error.',
  },
};

function StatusSelect({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: RedirectStatus;
  onChange: (status: RedirectStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <ui.Select
      value={String(value)}
      onValueChange={(next) => onChange(Number(next) as RedirectStatus)}
      disabled={disabled}
    >
      <ui.SelectTrigger className={compact ? 'w-28 h-8 text-xs' : 'w-full'} aria-label="Status">
        <ui.SelectValue />
      </ui.SelectTrigger>
      <ui.SelectContent>
        {STATUSES.map((status) => (
          <ui.SelectItem key={status.value} value={String(status.value)}>
            <span>{compact ? status.value : status.label}</span>
            {!compact && <span className="block text-xs text-muted-foreground">{status.hint}</span>}
          </ui.SelectItem>
        ))}
      </ui.SelectContent>
    </ui.Select>
  );
}

function GroupRow({
  group,
  value,
  onChange,
  disabled,
}: {
  group: RedirectGroup;
  value: Group;
  onChange: (next: Group) => void;
  disabled?: boolean;
}) {
  const { pattern, help } = GROUP_HELP[group];
  const id = `redirect-group-${group.slice(1)}`;
  return (
    <div className="p-3 space-y-3 border rounded-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ui.Label htmlFor={id} className="font-medium">
              {GROUP_LABELS[group]}
            </ui.Label>
            <code className="text-xs text-muted-foreground">{pattern}</code>
          </div>
          <p className="text-xs text-muted-foreground">{help}</p>
        </div>
        <ui.Switch
          id={id}
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          disabled={disabled}
          aria-label={`Redirect ${GROUP_LABELS[group].toLowerCase()}`}
        />
      </div>
      {value.enabled && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <ui.Label htmlFor={`${id}-to`} className="text-xs">
              To
            </ui.Label>
            <ui.Input
              id={`${id}-to`}
              value={value.to}
              placeholder={group === '$info' ? 'https://example.org/:slug' : 'https://example.org/'}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <ui.Label className="text-xs">Status</ui.Label>
            <StatusSelect
              value={value.status}
              onChange={(status) => onChange({ ...value, status })}
              disabled={disabled}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <ui.Checkbox
              checked={value.forwardQuery}
              onCheckedChange={(checked) => onChange({ ...value, forwardQuery: checked === true })}
              disabled={disabled}
            />
            Keep the query string (<code className="text-xs">?utm=…</code>) on the destination
          </label>
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  index,
  onChange,
  onRemove,
  disabled,
  autoFocus,
}: {
  rule: Rule;
  index: number;
  onChange: (next: Rule) => void;
  onRemove: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
    disabled,
  });
  const [showOptions, setShowOptions] = useState(false);
  const bindings = patternBindings(rule.from).map((b) => `:${b}`);
  const nonDefault = rule.status !== 302 || !rule.forwardQuery;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-md border bg-white dark:bg-slate-950 ${isDragging ? 'opacity-60 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-2 p-2">
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="mt-6 cursor-grab shrink-0 text-muted-foreground hover:text-foreground disabled:cursor-default"
          aria-label={`Reorder rule ${index + 1}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </ui.Button>
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <ui.Label htmlFor={`rule-${rule.id}-from`} className="text-xs">
              From
            </ui.Label>
            <ui.Input
              id={`rule-${rule.id}-from`}
              value={rule.from}
              placeholder="/old-path or /docs/*"
              onChange={(e) => onChange({ ...rule, from: e.target.value })}
              disabled={disabled}
              autoFocus={autoFocus}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <ui.Label htmlFor={`rule-${rule.id}-to`} className="text-xs">
              To
            </ui.Label>
            <ui.Input
              id={`rule-${rule.id}-to`}
              value={rule.to}
              placeholder="/new-path or https://…"
              onChange={(e) => onChange({ ...rule, to: e.target.value })}
              disabled={disabled}
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            <code>/about</code> exact · <code>/tags/:tag</code> one segment · <code>/docs/*</code>{' '}
            everything under. Available in To: {bindings.join(', ')}.
          </p>
          {showOptions && (
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <StatusSelect
                value={rule.status}
                onChange={(status) => onChange({ ...rule, status })}
                disabled={disabled}
                compact
              />
              <label className="flex items-center gap-2 text-xs">
                <ui.Checkbox
                  checked={rule.forwardQuery}
                  onCheckedChange={(checked) =>
                    onChange({ ...rule, forwardQuery: checked === true })
                  }
                  disabled={disabled}
                />
                Keep query string
              </label>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-6">
          {nonDefault && !showOptions && (
            <ui.Badge variant="secondary" className="text-xs">
              {rule.status}
              {!rule.forwardQuery ? ' · no query' : ''}
            </ui.Badge>
          )}
          <ui.SimpleTooltip title={showOptions ? 'Hide options' : 'Status and query string'}>
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowOptions((v) => !v)}
              aria-label={`Options for rule ${index + 1}`}
              aria-expanded={showOptions}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </ui.Button>
          </ui.SimpleTooltip>
          <ui.SimpleTooltip title="Remove rule">
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`Remove rule ${index + 1}`}
              className="shrink-0 text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </ui.Button>
          </ui.SimpleTooltip>
        </div>
      </div>
    </li>
  );
}

export function RedirectsField({
  value,
  onChange,
  disabled,
}: {
  value: RedirectsState;
  onChange: (next: RedirectsState) => void;
  disabled?: boolean;
}) {
  const [newRuleId, setNewRuleId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => {
    if (newRuleId) setNewRuleId(null);
  }, [newRuleId]);

  const setGroup = (group: RedirectGroup, next: Group) =>
    onChange({ ...value, groups: { ...value.groups, [group]: next } });
  const setRules = (rules: Rule[]) => onChange({ ...value, rules });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = value.rules.findIndex((rule) => rule.id === active.id);
    const newIndex = value.rules.findIndex((rule) => rule.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...value.rules];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setRules(next);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Rules</h3>
          <p className="text-xs text-muted-foreground">
            Checked top to bottom; the first match wins. Drag to reorder.
          </p>
        </div>
        {value.rules.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={value.rules.map((rule) => rule.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="space-y-2">
                {value.rules.map((rule, index) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    index={index}
                    disabled={disabled}
                    autoFocus={rule.id === newRuleId}
                    onChange={(next) =>
                      setRules(value.rules.map((r) => (r.id === rule.id ? next : r)))
                    }
                    onRemove={() => setRules(value.rules.filter((r) => r.id !== rule.id))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        <ui.Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const id = uuidv7();
            setRules([...value.rules, { id, from: '', ...DEFAULT_SPEC }]);
            setNewRuleId(id);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add rule
        </ui.Button>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Page groups</h3>
          <p className="text-xs text-muted-foreground">
            Applied after the rules, so a rule can carve an exception out of a group.
          </p>
        </div>
        {(Object.keys(GROUP_LABELS) as RedirectGroup[]).map((group) => (
          <GroupRow
            key={group}
            group={group}
            value={value.groups[group]}
            onChange={(next) => setGroup(group, next)}
            disabled={disabled}
          />
        ))}
      </section>
    </div>
  );
}
