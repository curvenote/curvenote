import { useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import type { FontFace, FontLicense, FontSlot, ThemeFontsConfig } from '../../themeConfig/types.js';
import { FONT_SLOTS, fontSlotSource } from '../../themeConfig/fonts.js';
import { SLOT_LABELS } from '../../themeConfig/validate.js';

/**
 * Platform-admin check of a site's font paperwork. Site admins upload the files on Website &
 * Design; only here — behind the Advanced page's system-admin scope — can they be marked as
 * read and accepted.
 */
function describeWeight(weight: FontFace['weight']) {
  if (weight === undefined) return '400';
  return typeof weight === 'string' ? `variable ${weight.replace(' ', '–')}` : String(weight);
}

/** Every font the site asks the theme to load, self-hosted or from Google, slot by slot. */
function RequestedFonts({ fonts }: { fonts: ThemeFontsConfig | undefined }) {
  const rows = FONT_SLOTS.map((name) => ({ name, slot: fonts?.[name] })).filter(
    (row): row is { name: (typeof FONT_SLOTS)[number]; slot: FontSlot } => !!row.slot,
  );
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No custom fonts configured.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-left text-muted-foreground">
          <th className="py-1 pr-4 font-medium">Slot</th>
          <th className="py-1 pr-4 font-medium">Family</th>
          <th className="py-1 pr-4 font-medium">Source</th>
          <th className="py-1 font-medium">Variants</th>
        </tr>
      </thead>
      <tbody className="align-top divide-y divide-stone-200 dark:divide-stone-700">
        {rows.map(({ name, slot }) => {
          const source = fontSlotSource(slot);
          return (
            <tr key={name}>
              <td className="py-2 pr-4 whitespace-nowrap">{SLOT_LABELS[name]}</td>
              <td className="py-2 pr-4">
                {slot.family}
                {slot.fallback && (
                  <span className="block text-xs text-muted-foreground">
                    fallback: {slot.fallback}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {source === 'custom' ? 'Uploaded' : source === 'google' ? 'Google Fonts' : 'Stack'}
              </td>
              <td className="py-2">
                {source === 'custom' && (
                  <ul className="space-y-1">
                    {(slot.faces ?? []).map((face) => (
                      <li key={face.src} className="flex items-center gap-2">
                        <span className="w-32 text-xs shrink-0 text-muted-foreground">
                          {describeWeight(face.weight)}
                          {face.style === 'italic' ? ' italic' : ''}
                        </span>
                        <a
                          href={face.src}
                          download
                          className="min-w-0 truncate underline underline-offset-2"
                          title={face.src}
                        >
                          {face.src.split('/').pop()}
                        </a>
                      </li>
                    ))}
                    {!slot.faces?.length && (
                      <li className="text-xs text-muted-foreground">No files</li>
                    )}
                  </ul>
                )}
                {source === 'google' && (
                  <span className="text-xs text-muted-foreground">
                    weights {(slot.weights ?? [400, 700]).join(', ')}
                    {slot.italic ? ' + italic' : ''}
                    {slot.display ? ` · ${slot.display}` : ''}
                  </span>
                )}
                {source === 'stack' && <span className="text-xs text-muted-foreground">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function FontLicenseForm({
  license,
  fonts,
}: {
  license: FontLicense | undefined;
  fonts: ThemeFontsConfig | undefined;
}) {
  const fetcher = useFetcher<{ error?: string; info?: string }>();
  const savedVerified = !!license?.verified;
  const [verified, setVerified] = useState(savedVerified);
  const dirty = verified !== savedVerified;
  const files = license?.files ?? [];

  return (
    <primitives.Card lift className="max-w-4xl px-6 space-y-4" validateUsing={fetcher}>
      <h2>Fonts &amp; License</h2>
      <p className="text-sm font-light">
        What the site asks the theme to load, and the files it uploaded to show it may serve the
        self-hosted ones. Read them, then mark the license as verified; the site sees the result on
        Website &amp; Design.
      </p>
      <h3 className="text-sm font-medium">Requested fonts</h3>
      <RequestedFonts fonts={fonts} />
      <h3 className="pt-2 text-sm font-medium">License files</h3>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No license files uploaded.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((file) => (
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
            </li>
          ))}
        </ul>
      )}
      <fetcher.Form method="POST" className="m-0 space-y-4" onSubmit={() => undefined}>
        <input type="hidden" name="formAction" value="font-license" />
        <input type="hidden" name="verified" value={verified ? 'true' : 'false'} />
        <div className="flex items-center space-x-2">
          <ui.Checkbox
            id="settings.fontLicenseVerified"
            checked={verified}
            disabled={files.length === 0}
            onCheckedChange={(checked: boolean) => setVerified(checked === true)}
          />
          <label
            htmlFor="settings.fontLicenseVerified"
            className="flex items-center gap-1.5 text-sm"
          >
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            License verified
          </label>
        </div>
        <div className="flex justify-end space-x-3">
          <ui.Button
            type="button"
            variant="secondary"
            disabled={!dirty || fetcher.state !== 'idle'}
            onClick={() => setVerified(savedVerified)}
          >
            Reset
          </ui.Button>
          <ui.StatefulButton
            variant="default"
            disabled={!dirty || fetcher.state !== 'idle'}
            overlayBusy
            busy={fetcher.state === 'submitting'}
            type="submit"
          >
            Save
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </primitives.Card>
  );
}
