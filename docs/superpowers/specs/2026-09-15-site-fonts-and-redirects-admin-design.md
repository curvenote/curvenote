# Site Fonts & Redirects Admin — PRD and Design Spec

**Status:** Draft
**Module:** `ee/sites` (site admin), with types from `@curvenote/common` in next-theme
**Depends on:** next-theme `fonts` branch (`theme_config.fonts`, `SiteThemeConfig`) and the
`journal-redirects` changeset (`theme_config.redirects`), both of which the theme already reads.

## Summary

The theme now honors two site-level settings that have no UI: **fonts**
(`theme_config.fonts`, four semantic slots, self-hosted or Google) and **redirects**
(`theme_config.redirects`, ordered rules plus the `$landing` / `$info` / `$notFound` groups).
Today both can only be set by editing the raw metadata JSON on **Advanced**. This spec adds:

1. A **Typography** section to the existing **Website & Design** page, with the preview
   showing the chosen fonts live.
2. A new **Domains & Redirects** page, folding the current **Domains** list in with an
   editor for redirects — they are the same concern (where does a URL go) and redirects
   are meaningless without knowing the site's hostnames.

Nothing here changes the theme. The admin writes the same `theme_config` shape the theme
already reads; validation reuses the matcher and font helpers from `@curvenote/common` /
`@curvenote/theme-ui` so the UI cannot save something the theme would reject.

## Goals

- A site admin can set body / heading / small / mono fonts without a deploy or a support
  ticket, from Google Fonts or from uploaded files, and see them in the preview before saving.
- A site admin can send `/`, info pages, 404s, or specific paths elsewhere — the DHR case
  (landing on a separate marketing site) — and can see, per rule, what it will do.
- Both surfaces are impossible to get into a state the theme cannot serve: bad URLs, loops,
  and theme-owned paths are caught at edit time with the same rules the theme applies.
- The raw JSON on **Advanced** keeps working as the escape hatch, and the two never
  disagree: the structured editors read and write the same keys.

## Non-goals

- Font licensing checks or a font marketplace. We host what the admin uploads.
- A visual redirect "designer" (drag arrows between pages). Rules are a list.
- Per-page or per-kind fonts. Fonts are site-wide by design (`ThemeFontsConfig` lives on
  `theme_config`, not `design`).
- Migrating the Domains table itself. It stays as it is; it gains a neighbor.
- Redirect analytics ("how many hits did this rule get"). Later.

## Where the data lives

Both live on `site.metadata.theme_config`, which `$actionUpdateSiteDesign` already
round-trips via `safeSiteMetadataUpdate`. The types are in `@curvenote/common`
(`packages/common/src/types/{design,redirects,journal}.ts`); the admin should import them,
not redeclare them.

```yaml
theme_config:
  fonts:
    heading: { family: Softcore, fallback: 'Georgia, serif', faces: [{ src: https://…/Softcore-Light.woff2, weight: 100 900 }] }
    body:    { family: Matter, faces: [{ src: …, weight: 400 }, { src: …, weight: 700 }] }
    small:   { family: Matter SemiMono, faces: [{ src: …, weight: 400 }] }
    mono:    { family: JetBrains Mono, source: google, weights: [400, 700] }
  redirects:
    $landing: https://digitalhatereview.com/
    $info: { to: https://digitalhatereview.com/:slug, status: 301 }
    rules:
      - { from: /about, to: /info/about }
      - { from: /docs/*, to: https://docs.example.org/:splat, status: 301, forward_query: false }
```

`JournalThemeConfig` in the admin is the deprecated type; the loader should move to
`SiteThemeConfig` (same shape, minus the dead `fonts.one/two/three` and `styles` keys).
If a site still carries the old `fonts: { one, two, three }`, the Typography section treats
it as unset and the save replaces it — those keys were never read by anything.

---

## Part 1 — Typography (Website & Design)

### Placement

A fifth accordion item, **Typography**, between **Colors** and **Footer**. Icon:
`lucide-react` `CaseSensitive`. Same section-dot behavior as the others: amber when
unsaved, red when a field has an error.

### Preview

The skeleton preview gains real text so fonts are visible:

- The hero title placeholder becomes the site title in the **heading** font.
- One card gains two lines of lorem in the **body** font and a caption line in the
  **small** font.
- The footer "Terms & Privacy" line stays in `font-ui` — it is chrome, deliberately not
  configurable, and the preview should show that boundary rather than hide it.

Each of those regions is a `Hotspot` with new targets — `fonts.heading`, `fonts.body`,
`fonts.small` — that open the Typography section and scroll to the slot. `fonts.mono` has
no natural place in the skeleton; it is reached from the panel only.

Fonts load in the preview through the same code the theme uses: `buildFontCss` /
`googleFontsHref` / `fontPreloads` from `@curvenote/theme-ui`, rendered into a `<style>`
scoped to the preview container (`.site-preview { --font-body: … }`) rather than `:root`,
so the admin app's own chrome is not restyled. The preview updates from the *unsaved* form
state, debounced 300 ms, so an admin sees a Google font swap in before committing.

### Panel

Four slot editors in a fixed order, each collapsed to one line until expanded:

```
Body        Noto Sans · Google · default            [Change]
Heading     Softcore · Uploaded · Light 300         [Change]
Small text  Follows body                            [Change]
Code        Follows theme default                   [Change]
```

Each slot row carries a dot — amber when it differs from what is saved, red when it has an
error — so a collapsed list still shows where the edits are.

Expanding a slot shows two tabs, **Choose a font** and **Upload a font**. The word
"Google" appears nowhere — an admin picks a font, not a vendor. Each tab keeps its own
draft: switching tabs changes which one is in effect, but nothing typed or uploaded on the
other tab is lost until Save or Reset.

- **Choose a font**
  - Font: dropdown only, over a bundled list of Google families (name + category), with
    the search field the same width as the dropdown. The **first entry is the default**
    ("Noto Sans (default)" for Body, "Same as Body" for Heading and Small text, "Default
    monospace" for Code), marked *default*; picking it clears the slot. No free text — a
    family saved by other means still appears as the current selection.
  - Everything else is behind an **Advanced** disclosure, collapsed by default:
    - Weights: checkbox row `300 400 500 600 700` plus an `All (variable)` toggle that sets
      `['100..900']`. Default `400, 700`.
    - Italic: checkbox → `italic: true`.
    - Loading: `swap` (default) / `block`. This is `display`.
    - Fallback stack: text, optional, placeholder `Georgia, serif`. Maps to `fallback`.
- **Upload a font**
  - Family name: text, required. This is what the `@font-face` is registered as.
  - Faces: list; each row is a file (`.woff2` preferred, `.woff`/`.otf`/`.ttf` accepted)
    with a download link, and on a second line its weight (select `100`–`900` or `Variable`
    → `"100 900"`) and style (`Normal`/`Italic`).
    Upload uses the existing `siteUploadsStage` / `siteUploadsComplete` flow with a new
    `fontUploadConfig` (slot `fonts`, max 2 MB, the four MIME types). The resulting CDN
    URL is `face.src`. Weight and style stay on the row — they identify the file.
  - **Advanced**: Loading and Fallback, as above.

### Font license

Shown at the top of the Typography section only when at least one slot is self-hosted.
Holds the paper trail for serving a commercial font: any number of files (license terms,
receipts — PDF, text or image, 5 MB each) listed with download links, an upload dropzone,
and a **Verified** switch that someone flips after reading them. Stored at
`site.metadata.font_license = { files: [{ src, name }], verified }`, beside `theme_config`;
the theme never reads it. Verified is a plain flag for now — any `site.update` holder can set
it; restricting it to system admins is a one-line scope check if that becomes policy.

### Validation (client + server, same rules)

Server-side validation is a zod schema built from the `@curvenote/common` types; the
client mirrors the messages. `$actionUpdateSiteDesign` gains a `fonts` field (JSON string,
like `footerLinks`), parsed and validated before the metadata update.

| condition | message |
| --- | --- |
| Upload slot with no faces | "Add at least one font file." |
| Face `src` not `https://` (or not on the site's CDN) | "Font files must be uploaded here, not linked." |
| `family` empty | "Give the font a name." |
| Google `weights` empty | "Pick at least one weight." |
| `fallback` contains `;`, `{`, `}`, `url(` | "Fallback should be a list of font names, like `Georgia, serif`." |
| Variable weight file but weight `400` chosen | warning, not error: "This looks like a variable font — choose Variable to use all its weights." (detect from `wght` axis in the uploaded file's `fvar` table if we parse it server-side; otherwise skip) |

The `isSafeUrl` check in `buildFontCss` is the last line; the admin should never let a
value reach it that it would drop silently.

### Copy & help

Section `(i)` tooltip: "Fonts for article text. Site navigation and buttons keep the
system font so they never look foreign." Link to docs.

Warnings shown inline, once, when relevant:

- Upload with no italic face while body slot: "No italic uploaded — browsers will slant
  the regular face for emphasis. Ask the foundry for an italic if this matters."
- Heading upload with a single weight: "One weight uploaded. Headings render at several
  weights; choose Variable if this file covers them, or upload more weights."

---

## Part 2 — Domains & Redirects (new page)

### Placement

Rename the sidebar item **Domains** → **Domains & Redirects** at the same position and URL
(`$siteName.domains`). Scope stays `site.domains.list` for viewing; editing redirects
requires `site.update` (same as Website & Design), so the redirects half renders read-only
for a user who has the first but not the second.

The page is two stacked sections with section headings, no tabs:

1. **Domains** — the existing table and add-form, untouched.
2. **Redirects** — new, in a white `primitives.Card` so it reads as one unit against the
   page background.

### Redirects section

Intro line: "Send visitors to a different page or site. Rules are checked top to bottom;
the first match wins, then the page groups below."

**Page groups** — three fixed rows, always present, each `Off` by default:

```
Landing page  /                     → [ off | Redirect to … ]
Info pages    /:slug                → [ off | Redirect to … ]
Not found     anything that 404s    → [ off | Redirect to … ]
```

Turning one on reveals: **To** (text, URL or path; may use `:slug` on info pages, `:path`
on all), **Status** (`302 Temporary` default · `301 Permanent`, with the tooltip "Use
permanent only when the old address will never come back — browsers cache it"), **Keep
query string** (checkbox, default on). The theme also honors `307`/`308`, but the admin
never offers them and the server refuses them: we do not want a redirect to carry a form
post to another site. These map to `$landing`, `$info`,
`$notFound` as a `RedirectSpec` (or a bare string when status and query are defaults).

**Rules** — an ordered list, drag to reorder (same `dnd` pattern as `FooterLinksField`),
`+ Add rule`, trash per row. Each row:

```
From  /docs/*             To  https://docs.example.org/:splat    301 ▾   [⋮]
```

- **From**: path pattern. Helper on focus: "`/about` exact · `/tags/:tag` one segment ·
  `/docs/*` everything under (also matches `/docs`)".
- **To**: path or URL. Helper lists the bindings available from *this* From — `:tag`,
  `:splat`, `:path` — computed live from the pattern.
- Status and query are behind the `⋮` to keep the row to one line; the row shows the
  status code as a badge when it is not 302.

**Test a URL** — a single input at the bottom: type a path, see what the current
*unsaved* config does with it, using `matchRedirect` / `matchNotFoundRedirect` from
`@curvenote/common`:

```
/docs/getting-started   →   301  https://docs.example.org/getting-started   (rule 2)
/about                  →   no redirect
/api/health             →   no redirect (theme path — only a rule naming it exactly applies)
```

This is the feature that makes the page trustworthy; the matcher is already pure and
shared, so it is cheap.

### Validation

Same split as fonts: zod on the server, mirrored on the client; a new `redirects` field on
the domains action (`intent: 'redirects.update'`).

| condition | message |
| --- | --- |
| `from` not starting with `/` | "From must be a site path, starting with `/`." |
| `from` duplicates an earlier rule | "This path is already handled by rule N above." (warning — later rule is unreachable) |
| `to` not a path or `http(s)://` URL | "To must be a path on this site or a full https:// address." |
| `to` references a `:param` the pattern does not bind | "`:tag` isn't in the From pattern. Available: `:splat`, `:path`." |
| `to` resolves to the same site and would match its own `from` | "This would redirect to itself." (uses the matcher with each of the site's domains — this is why the page needs the Domains list) |
| `status` is `307` or `308` | "uses status 307; only temporary (302) and permanent (301) are supported" — enforced by the zod schema on the server as well |
| `from` is a theme-owned path (`/api/*`, `/sitemap.xml`, …) | warning: "Theme paths only redirect when named exactly; `/api/*` will not match `/api/health`." |
| `$notFound` on, `to` is a site path that is itself a 404 | warning: "`/missing` doesn't exist either — visitors will loop to the error page." (checked against the site's known page slugs if cheap; otherwise omit) |

### Copy & help

Section `(i)`: "Redirects run on the site before any page loads, so they are fast and
work for search engines. Paths the theme owns — the API, sitemap, login — are protected
unless a rule names them exactly."

---

## Advanced page

Unchanged, except: the `theme_config` block in the JSON editor gets a one-line note above
it, "Fonts and redirects have editors on Website & Design and Domains & Redirects; edits
here are validated the same way on save." The action already writes through
`safeSiteMetadataUpdate`; it should run the same zod schemas on `theme_config.fonts` and
`theme_config.redirects` so the escape hatch cannot produce something the structured
editors would refuse.

## Analytics

Mirror what Website & Design already captures for logo/color changes:

- `site_fonts_updated` — `{ slots_set: ['body','heading'], sources: { body: 'upload', heading: 'google' }, display: 'block' }`
- `site_redirects_updated` — `{ rules: n, groups: ['$landing'], statuses: { 301: 1, 302: 2 } }`
- `site_redirect_tested` — `{ matched: true, kind: 'rule' | '$landing' | … }`

No PII; no URLs in properties.

## Rollout

1. **Types first**: admin imports `SiteThemeConfig`, `ThemeFontsConfig`,
   `ThemeRedirectsConfig` and the matcher from `@curvenote/common`; bump the dependency
   once the next-theme `fonts` branch is released.
2. **Redirects page** ships first — it is smaller, it unblocks DHR's landing redirect
   (currently set by hand), and the test-a-URL box is the highest-value single piece.
3. **Typography** second — it needs the upload config and the preview font plumbing.
4. Both behind the existing `site.update` scope; no new flag. Sites with nothing set see
   the Default / Off states and are unaffected.

## Open questions

- **Google Fonts list**: bundle a static JSON of family names (a few hundred KB) or fetch
  from the Google Fonts developer API at build time? Static is simpler and the list
  changes slowly; a free-text fallback covers gaps.
- **Font file inspection**: parsing `fvar`/`OS/2` on upload (via `fontkit` or `opentype.js`)
  would let us prefill weight/style and warn about variable fonts. Worth it if the upload
  path is already server-side; skip for v1 if it is direct-to-bucket.
- **Should `Not found` redirects show in the sitemap tooling?** The theme already filters
  redirected paths out of `sitemap.xml`; the admin might surface that ("N paths hidden from
  the sitemap by these rules") but it needs the page list. Later.
- **Preview fidelity for uploaded fonts**: the preview can only render a font once it is
  on the CDN, i.e. after upload completes but before Save. That is fine — upload is its
  own commit — but the Reset button must then leave the uploaded file orphaned. Acceptable
  for v1; note it in the help text.
