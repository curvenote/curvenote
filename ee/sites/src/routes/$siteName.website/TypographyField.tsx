import { FileDropzone, ui } from '@curvenote/scms-core';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { FONT_SLOTS, fontSlotSource, type FontSlotName } from '../../themeConfig/fonts.js';
import type { FontFace, FontLicense, FontSlot, ThemeFontsConfig } from '../../themeConfig/types.js';
import { SLOT_LABELS, fontSlotError, fontsWarnings } from '../../themeConfig/validate.js';
import { verificationInvalidated } from '../../themeConfig/license.js';
import { GOOGLE_FONTS } from './googleFonts.js';
import {
  activeDraft,
  editDraft,
  reconcileDrafts,
  seedDrafts,
  signatureOf,
  switchDraftTab,
  type DraftState,
} from './fontDrafts.js';

/*
 * Editor for `theme_config.fonts`. Four slots, each either left to the theme's default, a
 * Google Fonts family, or files uploaded to the site's CDN. Reports a `ThemeFontsConfig` with
 * the slots that are set; an unset slot is simply absent, which is how the theme reads "default".
 */

export const FONT_UPLOAD_SLOT = 'fonts';
export const FONT_LICENSE_UPLOAD_SLOT = 'font-license';
/** Scanned receipts run large; shared by the dropzone (early warning) and the server config. */
export const LICENSE_MAX_BYTES = 25 * 1024 * 1024;

const LICENSE_ACCEPT = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.md'],
  'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
};

const GOOGLE_WEIGHTS = [300, 400, 500, 600, 700] as const;
const FACE_WEIGHTS = [
  { value: '100', label: '100 Thin' },
  { value: '200', label: '200 Extra light' },
  { value: '300', label: '300 Light' },
  { value: '400', label: '400 Regular' },
  { value: '500', label: '500 Medium' },
  { value: '600', label: '600 Semibold' },
  { value: '700', label: '700 Bold' },
  { value: '800', label: '800 Extra bold' },
  { value: '900', label: '900 Black' },
  { value: 'variable', label: 'Variable (all weights)' },
];

type Source = 'default' | 'google' | 'custom';

const SLOT_HELP: Record<FontSlotName, { used: string; unset: string }> = {
  body: { used: 'Article text and the abstract.', unset: 'Noto Sans (default)' },
  heading: { used: 'Headings and the title block.', unset: 'Same as Body' },
  small: { used: 'Footnotes, captions and backmatter.', unset: 'Same as Body' },
  mono: { used: 'Code blocks and inline code.', unset: 'Default monospace' },
};

/** The dropdown's first entry: picking it clears the slot back to the theme default. */
const DEFAULT_OPTION = '__default__';

const FONT_ACCEPT = {
  'font/woff2': ['.woff2'],
  'font/woff': ['.woff'],
  'font/otf': ['.otf'],
  'font/ttf': ['.ttf'],
};

function sourceOf(slot: FontSlot | undefined): Source {
  const source = fontSlotSource(slot);
  if (!source) return 'default';
  return source === 'google' ? 'google' : 'custom';
}

function summarize(slot: FontSlot | undefined, name: FontSlotName): string {
  const source = sourceOf(slot);
  if (source === 'default' || !slot) return SLOT_HELP[name].unset;
  if (source === 'google') return slot.family || 'Choose a font';
  const faces = slot.faces?.length ?? 0;
  return `${slot.family || 'Untitled'} · Uploaded · ${faces} ${faces === 1 ? 'file' : 'files'}`;
}

function faceWeightValue(face: FontFace): string {
  if (typeof face.weight === 'string') return 'variable';
  return String(face.weight ?? 400);
}

function DisplaySelect({
  value,
  onChange,
  disabled,
}: {
  value: FontSlot['display'];
  onChange: (display: FontSlot['display']) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <ui.Label className="text-xs">Loading</ui.Label>
      <ui.Select
        value={value ?? 'swap'}
        onValueChange={(next) => onChange(next as FontSlot['display'])}
        disabled={disabled}
      >
        <ui.SelectTrigger className="w-full">
          <ui.SelectValue />
        </ui.SelectTrigger>
        <ui.SelectContent>
          <ui.SelectItem value="swap">
            Swap
            <span className="block text-xs text-muted-foreground">
              Show a fallback first, then swap in. Text may shift once.
            </span>
          </ui.SelectItem>
          <ui.SelectItem value="block">
            Block
            <span className="block text-xs text-muted-foreground">
              Hide text until the font arrives. Nothing moves.
            </span>
          </ui.SelectItem>
        </ui.SelectContent>
      </ui.Select>
    </div>
  );
}

function FallbackInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string | undefined;
  onChange: (fallback: string | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <ui.Label htmlFor={id} className="text-xs">
        Fallback fonts
      </ui.Label>
      <ui.Input
        id={id}
        value={value ?? ''}
        placeholder="Georgia, serif"
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        Shown while the font loads and if it fails to.
      </p>
    </div>
  );
}

/** Settings most sites never touch, folded away so the common path stays short. */
function Advanced({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-1">
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-advanced`}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Advanced
      </button>
      {open && (
        <div id={`${id}-advanced`} className="pt-3 pl-1 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function ChooseEditor({
  id,
  name,
  slot,
  onChange,
  disabled,
}: {
  id: string;
  name: FontSlotName;
  /** Undefined means the theme default, shown as the first entry. */
  slot: FontSlot | undefined;
  onChange: (slot: FontSlot | undefined) => void;
  disabled?: boolean;
}) {
  const family = slot?.family ?? '';
  // A family saved by hand (or from an older list) still has to show as the selection
  const known = !family || GOOGLE_FONTS.some((font) => font.family === family);
  const options = [
    { value: DEFAULT_OPTION, label: SLOT_HELP[name].unset, description: 'default' },
    ...(family && !known ? [{ value: family, label: family, description: 'saved' }] : []),
    ...GOOGLE_FONTS.map((font) => ({
      value: font.family,
      label: font.family,
      description: font.category,
    })),
  ];
  const variable = slot?.weights?.some((w) => typeof w === 'string');
  const chosen = new Set((slot?.weights ?? [400, 700]).map((w) => String(w)));
  const update = (patch: Partial<FontSlot>) =>
    onChange({ family, source: 'google', weights: [400, 700], ...slot, ...patch });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <ui.Label htmlFor={`${id}-family`} className="text-xs">
          Font
        </ui.Label>
        <ui.ClientComboBox
          options={options}
          value={slot ? family : DEFAULT_OPTION}
          onValueChange={(value) => {
            if (!value || value === DEFAULT_OPTION) onChange(undefined);
            else update({ family: value });
          }}
          placeholder="Choose a font…"
          searchPlaceholder="Search fonts"
          emptyMessage="No matching font."
          disabled={disabled}
          contentClassName="w-[var(--radix-popover-trigger-width)]"
        />
      </div>
      {slot && (
        <Advanced id={id}>
          <div className="space-y-1.5">
            <ui.Label className="text-xs">Weights</ui.Label>
            <div className="flex flex-wrap items-center gap-3">
              {GOOGLE_WEIGHTS.map((weight) => (
                <label key={weight} className="flex items-center gap-1.5 text-sm">
                  <ui.Checkbox
                    checked={!variable && chosen.has(String(weight))}
                    disabled={disabled || variable}
                    onCheckedChange={(checked) => {
                      const next = new Set(chosen);
                      if (checked === true) next.add(String(weight));
                      else next.delete(String(weight));
                      update({ weights: [...next].map(Number).sort((a, b) => a - b) });
                    }}
                  />
                  {weight}
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-sm">
                <ui.Checkbox
                  checked={!!variable}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    update({ weights: checked === true ? ['100..900'] : [400, 700] })
                  }
                />
                All (variable)
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Regular and bold are loaded by default.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <ui.Checkbox
              checked={!!slot.italic}
              disabled={disabled}
              onCheckedChange={(checked) => update({ italic: checked === true || undefined })}
            />
            Include italics
          </label>
          <DisplaySelect
            value={slot.display}
            onChange={(display) => update({ display })}
            disabled={disabled}
          />
          <FallbackInput
            id={`${id}-fallback`}
            value={slot.fallback}
            onChange={(fallback) => update({ fallback })}
            disabled={disabled}
          />
        </Advanced>
      )}
    </div>
  );
}

function UploadEditor({
  id,
  name,
  slot,
  onChange,
  disabled,
  uploadFolder,
  toPublicUrl,
}: {
  id: string;
  name: FontSlotName;
  slot: FontSlot;
  onChange: (slot: FontSlot) => void;
  disabled?: boolean;
  uploadFolder: string;
  toPublicUrl: (uploadedPath: string) => string;
}) {
  const faces = slot.faces ?? [];
  const setFace = (index: number, face: FontFace) =>
    onChange({ ...slot, faces: faces.map((f, i) => (i === index ? face : f)) });
  // Advice about the files themselves belongs next to them, not at the top of the section
  const warnings = fontsWarnings({ [name]: slot });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <ui.Label htmlFor={`${id}-family`} className="text-xs">
          Font name
        </ui.Label>
        <ui.Input
          id={`${id}-family`}
          value={slot.family}
          placeholder="e.g. Matter"
          onChange={(e) => onChange({ ...slot, family: e.target.value })}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          The name the files are registered under. Any name works; keep it the same across weights.
        </p>
      </div>
      <div className="space-y-2">
        <ui.Label className="text-xs">Font files</ui.Label>
        {faces.map((face, index) => {
          const fileName = face.src.split('/').pop() ?? face.src;
          return (
            <div key={index} className="p-3 space-y-2 border rounded-md">
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 text-xs truncate" title={fileName}>
                  {fileName}
                </code>
                <ui.SimpleTooltip title="Download file">
                  <ui.Button
                    asChild
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <a href={face.src} download={fileName} aria-label={`Download ${fileName}`}>
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </ui.Button>
                </ui.SimpleTooltip>
                <ui.SimpleTooltip title="Remove file">
                  <ui.Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    aria-label={`Remove ${fileName}`}
                    className="shrink-0 text-muted-foreground hover:text-red-600"
                    onClick={() =>
                      onChange({ ...slot, faces: faces.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </ui.Button>
                </ui.SimpleTooltip>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <ui.Label className="text-xs text-muted-foreground">Weight</ui.Label>
                  <ui.Select
                    value={faceWeightValue(face)}
                    disabled={disabled}
                    onValueChange={(value) =>
                      setFace(index, {
                        ...face,
                        weight: value === 'variable' ? '100 900' : Number(value),
                      })
                    }
                  >
                    <ui.SelectTrigger className="w-full h-8 text-xs" aria-label="Weight">
                      <ui.SelectValue />
                    </ui.SelectTrigger>
                    <ui.SelectContent>
                      {FACE_WEIGHTS.map((w) => (
                        <ui.SelectItem key={w.value} value={w.value}>
                          {w.label}
                        </ui.SelectItem>
                      ))}
                    </ui.SelectContent>
                  </ui.Select>
                </div>
                <div className="space-y-1">
                  <ui.Label className="text-xs text-muted-foreground">Style</ui.Label>
                  <ui.Select
                    value={face.style ?? 'normal'}
                    disabled={disabled}
                    onValueChange={(value) =>
                      setFace(index, { ...face, style: value === 'italic' ? 'italic' : undefined })
                    }
                  >
                    <ui.SelectTrigger className="w-full h-8 text-xs" aria-label="Style">
                      <ui.SelectValue />
                    </ui.SelectTrigger>
                    <ui.SelectContent>
                      <ui.SelectItem value="normal">Normal</ui.SelectItem>
                      <ui.SelectItem value="italic">Italic</ui.SelectItem>
                    </ui.SelectContent>
                  </ui.Select>
                </div>
              </div>
            </div>
          );
        })}
        <FileDropzone
          folder={uploadFolder}
          slot={FONT_UPLOAD_SLOT}
          readonly={disabled}
          height="56px"
          className="p-3"
          inline
          label={faces.length ? 'Add another weight or style' : 'Upload a .woff2 file'}
          accept={FONT_ACCEPT}
          maxSize={2 * 1024 * 1024}
          onUploadComplete={(uploadedPath) =>
            onChange({
              ...slot,
              faces: [...faces, { src: toPublicUrl(uploadedPath), weight: 400 }],
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          <code>.woff2</code> is smallest; <code>.woff</code>, <code>.otf</code> and{' '}
          <code>.ttf</code> also work. Make sure the license covers web use.
        </p>
        {warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Advanced id={id}>
        <DisplaySelect
          value={slot.display}
          onChange={(display) => onChange({ ...slot, display })}
          disabled={disabled}
        />
        <FallbackInput
          id={`${id}-fallback`}
          value={slot.fallback}
          onChange={(fallback) => onChange({ ...slot, fallback })}
          disabled={disabled}
        />
      </Advanced>
    </div>
  );
}

/** Row indicator: amber for unsaved edits, red when the slot needs fixing. */
function SlotDot({ error }: { error?: string }) {
  const label = error ?? 'Unsaved changes';
  return (
    <ui.SimpleTooltip title={label} className="max-w-xs text-left">
      <span role="status" aria-label={label} className="flex">
        <ui.Dot className={error ? 'bg-red-500' : 'bg-amber-500'} />
      </span>
    </ui.SimpleTooltip>
  );
}

function SlotEditor({
  name,
  slot,
  changed,
  error,
  onChange,
  disabled,
  uploadFolder,
  toPublicUrl,
  open,
  onToggle,
}: {
  name: FontSlotName;
  slot: FontSlot | undefined;
  changed: boolean;
  error?: string;
  onChange: (slot: FontSlot | undefined) => void;
  disabled?: boolean;
  uploadFolder: string;
  toPublicUrl: (uploadedPath: string) => string;
  open: boolean;
  onToggle: () => void;
}) {
  const id = `font-${name}`;
  // Each tab keeps its own draft, so flipping between them loses nothing until Save/Reset
  const [state, setState] = useState<DraftState>(() => seedDrafts(slot));
  // Re-seed only when the value is replaced from outside (Reset, new loader data)
  const [seenSignature, setSeenSignature] = useState(signatureOf(slot));
  const signature = signatureOf(slot);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setState((current) => reconcileDrafts(current, slot));
  }
  const { tab, drafts } = state;

  const switchTab = (next: string) => {
    const nextState = switchDraftTab(state, next as 'choose' | 'upload');
    if (nextState === state) return;
    setState(nextState);
    onChange(activeDraft(nextState));
  };
  const changeGoogle = (next: FontSlot | undefined) => {
    setState((current) => editDraft(current, 'choose', next));
    onChange(next);
  };
  const changeCustom = (next: FontSlot) => {
    setState((current) => editDraft(current, 'upload', next));
    onChange(next);
  };
  const customDraft = drafts.custom ?? { family: '', source: 'custom' as const, faces: [] };

  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="flex items-center w-full gap-3 p-4 text-left cursor-pointer"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-editor`}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="flex items-center w-28 gap-2 text-sm font-medium">
          {SLOT_LABELS[name]}
          {(changed || error) && <SlotDot error={error} />}
        </span>
        <span className="flex-1 min-w-0 text-sm truncate text-muted-foreground">
          {summarize(slot, name)}
        </span>
      </button>
      {open && (
        <div id={`${id}-editor`} className="px-4 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground">{SLOT_HELP[name].used}</p>
          <ui.Tabs value={tab} onValueChange={switchTab}>
            <ui.TabsList className="w-full">
              <ui.TabsTrigger value="choose" className="flex-1 cursor-pointer" disabled={disabled}>
                Choose a font
              </ui.TabsTrigger>
              <ui.TabsTrigger value="upload" className="flex-1 cursor-pointer" disabled={disabled}>
                Upload a font
              </ui.TabsTrigger>
            </ui.TabsList>
            <ui.TabsContent value="choose" className="pt-4">
              <ChooseEditor
                id={id}
                name={name}
                slot={drafts.google}
                onChange={changeGoogle}
                disabled={disabled}
              />
            </ui.TabsContent>
            <ui.TabsContent value="upload" className="pt-4">
              <UploadEditor
                id={id}
                name={name}
                slot={customDraft}
                onChange={changeCustom}
                disabled={disabled}
                uploadFolder={uploadFolder}
                toPublicUrl={toPublicUrl}
              />
            </ui.TabsContent>
          </ui.Tabs>
        </div>
      )}
    </div>
  );
}

/**
 * Receipts and license terms for uploaded fonts. Rendered by the route as its own section,
 * beneath Typography, only when a slot is self-hosted — Google Fonts need no paperwork.
 */
export function LicenseField({
  license,
  onChange,
  disabled,
  uploadFolder,
  toPublicUrl,
}: {
  license: FontLicense;
  onChange: (license: FontLicense) => void;
  disabled?: boolean;
  uploadFolder: string;
  toPublicUrl: (uploadedPath: string) => string;
}) {
  const files = license.files ?? [];
  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li key={file.src} className="flex items-center gap-2 text-sm">
              <a
                href={file.src}
                download={file.name}
                className="flex-1 min-w-0 truncate underline underline-offset-2"
                title={file.name}
              >
                {file.name}
              </a>
              <ui.SimpleTooltip title="Download">
                <ui.Button
                  asChild
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <a href={file.src} download={file.name} aria-label={`Download ${file.name}`}>
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </ui.Button>
              </ui.SimpleTooltip>
              <ui.SimpleTooltip title="Remove">
                <ui.Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 text-muted-foreground hover:text-red-600"
                  onClick={() =>
                    onChange({ ...license, files: files.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </ui.Button>
              </ui.SimpleTooltip>
            </li>
          ))}
        </ul>
      )}
      <FileDropzone
        folder={uploadFolder}
        slot={FONT_LICENSE_UPLOAD_SLOT}
        readonly={disabled}
        height="56px"
        className="p-3"
        inline
        label={files.length ? 'Add another file' : 'Upload license or receipt'}
        accept={LICENSE_ACCEPT}
        maxSize={LICENSE_MAX_BYTES}
        onUploadComplete={(uploadedPath) =>
          onChange({
            ...license,
            files: [
              ...files,
              {
                src: toPublicUrl(uploadedPath),
                name: uploadedPath.split('/').pop() ?? uploadedPath,
              },
            ],
          })
        }
      />
    </div>
  );
}

/**
 * The license as one more row under the slots: collapsed, the summary says how many files are
 * on record and where verification stands; expanded, the files and the dropzone.
 */
export function LicenseRow({
  license,
  savedLicense,
  changed,
  invalidated,
  error,
  onChange,
  disabled,
  uploadFolder,
  toPublicUrl,
  open,
  onToggle,
}: {
  license: FontLicense;
  savedLicense: FontLicense;
  changed: boolean;
  /** Unsaved edits that will drop the saved verification once saved. */
  invalidated: boolean;
  error?: string;
  onChange: (license: FontLicense) => void;
  disabled?: boolean;
  uploadFolder: string;
  toPublicUrl: (uploadedPath: string) => string;
  open: boolean;
  onToggle: () => void;
}) {
  const count = license.files?.length ?? 0;
  const savedCount = savedLicense.files?.length ?? 0;
  let status: React.ReactNode;
  if (invalidated && (savedCount || count)) {
    // Unsaved edits that will drop verification: say so before Save, not after
    status = (
      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <Clock className="w-4 h-4 shrink-0" />
        Requires verification
      </span>
    );
  } else if (savedLicense.verified && savedCount) {
    status = (
      <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        Verified
      </span>
    );
  } else if (savedCount) {
    status = (
      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <Clock className="w-4 h-4 shrink-0" />
        Awaiting verification
      </span>
    );
  } else {
    status = 'No files yet';
  }
  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="flex items-center w-full gap-3 p-4 text-left cursor-pointer"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="font-license-editor"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="flex items-center w-28 gap-2 text-sm font-medium">
          License
          {(changed || error) && <SlotDot error={error} />}
        </span>
        <span className="flex-1 min-w-0 text-sm truncate text-muted-foreground">{status}</span>
      </button>
      {open && (
        <div id="font-license-editor" className="px-4 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            License terms and receipts for the fonts you have uploaded. At least one file is needed
            before saving; they are verified after you save.
          </p>
          <LicenseField
            license={license}
            onChange={onChange}
            disabled={disabled}
            uploadFolder={uploadFolder}
            toPublicUrl={toPublicUrl}
          />
          <LicenseCallout saved={savedLicense} />
        </div>
      )}
    </div>
  );
}

/**
 * Where the paperwork stands, from what is *saved* — unsaved uploads have not reached anyone
 * yet. Verified is deliberately quiet; awaiting review is the state worth noticing.
 */
export function LicenseCallout({ saved }: { saved: FontLicense }) {
  if (!saved.files?.length) return null;
  if (saved.verified) {
    return (
      <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        Verified.
      </p>
    );
  }
  return (
    <div
      role="status"
      className="flex items-start gap-3 p-3 text-sm font-medium border rounded-md text-amber-900 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-950/40 dark:border-amber-900"
    >
      <Clock className="w-5 h-5 mt-0.5 shrink-0" />
      <div>
        Awaiting verification.
        <div className="font-normal">The license files will be reviewed and marked verified.</div>
      </div>
    </div>
  );
}

export function TypographyField({
  fonts,
  savedFonts,
  onChange,
  license,
  savedLicense,
  licenseError,
  onLicenseChange,
  disabled,
  uploadFolder,
  toPublicUrl,
  openSlot,
}: {
  fonts: ThemeFontsConfig;
  /** What is stored, so each slot can show whether it has unsaved edits. */
  savedFonts: ThemeFontsConfig;
  onChange: (fonts: ThemeFontsConfig) => void;
  license: FontLicense;
  savedLicense: FontLicense;
  licenseError?: string;
  onLicenseChange: (license: FontLicense) => void;
  disabled?: boolean;
  uploadFolder: string;
  toPublicUrl: (uploadedPath: string) => string;
  /** A slot to expand, e.g. when the preview is clicked. */
  openSlot?: FontSlotName;
}) {
  const [open, setOpen] = useState<FontSlotName | 'license' | undefined>(openSlot);
  const [lastOpenSlot, setLastOpenSlot] = useState(openSlot);
  // Follow the preview's choice when it changes, without fighting the user's own toggling
  if (openSlot !== lastOpenSlot) {
    setLastOpenSlot(openSlot);
    if (openSlot) setOpen(openSlot);
  }
  return (
    <div className="space-y-3">
      {FONT_SLOTS.map((name) => (
        <div key={name} id={`field-font-${name}`}>
          <SlotEditor
            name={name}
            slot={fonts[name]}
            changed={signatureOf(fonts[name]) !== signatureOf(savedFonts[name])}
            error={fontSlotError(fonts, name)}
            disabled={disabled}
            uploadFolder={uploadFolder}
            toPublicUrl={toPublicUrl}
            open={open === name}
            onToggle={() => setOpen((current) => (current === name ? undefined : name))}
            onChange={(slot) => {
              const next = { ...fonts };
              if (slot) next[name] = slot;
              else delete next[name];
              onChange(next);
            }}
          />
        </div>
      ))}
      {hasUploadedFonts(fonts) && (
        <div id="field-font-license">
          <LicenseRow
            license={license}
            savedLicense={savedLicense}
            changed={JSON.stringify(license) !== JSON.stringify(savedLicense)}
            invalidated={verificationInvalidated(
              { fonts: savedFonts, license: savedLicense },
              { fonts, license },
            )}
            error={licenseError}
            onChange={onLicenseChange}
            disabled={disabled}
            uploadFolder={uploadFolder}
            toPublicUrl={toPublicUrl}
            open={open === 'license'}
            onToggle={() => setOpen((current) => (current === 'license' ? undefined : 'license'))}
          />
        </div>
      )}
    </div>
  );
}

/** Whether any slot is self-hosted — the condition for showing the license section at all. */
export function hasUploadedFonts(fonts: ThemeFontsConfig): boolean {
  return FONT_SLOTS.some((name) => fontSlotSource(fonts[name]) === 'custom');
}
