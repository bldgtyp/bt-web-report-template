# bt-web-report-template

Shared Astro renderer and seed content for BLDGTYP Passive House report repos.

Per-project repos are content-only. A project `04_Web/` should contain
`project.yaml`, `content/`, `data/`, `public/assets/`, `.github/`, and small
metadata files only. It should not contain `package.json`, `node_modules`,
`.astro`, `.wrangler`, `dist`, or local test output.

## Local Runtime

Use the CLI from a project folder or pass the project path explicitly:

```bash
btwr scrape /path/to/Project/04_Web
btwr preview /path/to/Project/04_Web
btwr editor /path/to/Project/04_Web
btwr build /path/to/Project/04_Web
```

`btwr preview`, `btwr editor`, and `btwr build` run this renderer from the
shared app-support runtime:

```text
~/Library/Application Support/bt-web-report-manager/
├── renderer/current/
│   └── node_modules/
├── pnpm-store/
├── builds/<slug>/
├── previews/<slug>/
└── cache/
```

Node dependencies are installed once in `renderer/current/node_modules/`.
Disposable `builds/<slug>/` and `previews/<slug>/` workspaces symlink to that
shared app-support install; project repos never receive `node_modules/`.

During platform development, set `BTWR_RENDERER_SOURCE` or pass
`--renderer-source /path/to/bt-web-report-template` so the shared runtime can be
refreshed from this repo.

If the shared renderer needs to install private `@bldgtyp/*` packages, `btwr`
uses `NODE_AUTH_TOKEN` when present, otherwise it asks `gh auth token` and passes
that token to pnpm through a temporary npm config. Tokens are not written into
the project repo or app-support folder.

## Renderer Commands

These commands are for platform development inside this renderer repo:

```bash
pnpm install
pnpm validate
pnpm dev
pnpm dev:editor
pnpm check
pnpm check:editor
pnpm build
pnpm build:editor
pnpm build:pdf
pnpm smoke:fixture
```

Use pnpm only.

## Dev Preview Modes

Use the Vandam fixture mode for normal report UI work:

```bash
cd /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/bldgtyp/bt-web-report
pnpm --filter @bldgtyp/web-report-template dev:fixture
```

Open the `Local` URL printed by Astro, usually:

```text
http://127.0.0.1:4321/
http://127.0.0.1:4321/building_envelope/
```

`dev:fixture` sets `BTWR_DATA_DIR=../test-files/phpp/2606-Vandam-St/scrape-output`,
so charts, tables, and recommended-variant UI render with real PHPP scrape
data while the committed seed `data/` directory stays untouched.

Use plain `pnpm --filter @bldgtyp/web-report-template dev` only when testing
empty/new-project pending states. The committed seed
`bt-web-report-template/data/manifest.json` is intentionally:

```json
{ "status": "pending", "variants": [] }
```

If Astro says port `4321` is already in use, use the next `Local` URL it prints
instead, such as `4322` or `4323`.

## Project Edit Boundaries

- Edit `project.yaml` for project metadata, publish URL, local data paths,
  and the `narrative:` block of prose-facing values that MDX references via
  the `<Var>` shortcode (see [Project variables and `<Var>`](#project-variables-and-var) below).
- Edit `content/**/*.mdx` for report narrative. Each rendered report section
  has one MDX file that owns its title, section number, editorial heading, and
  prose; Astro routes only compose those sections with charts, tables, cards,
  and other data-driven components.
- **Which sections a page renders is decided by which files exist.** Each page
  globs its content directory (`content/energy-model/`, `content/envelope/`,
  `content/windows/`, `content/mechanical/`), so adding or deleting a prose
  `.mdx` adds or removes that section from the page, its TOC, the print body,
  and the print TOC — no renderer change. Sections sort by their `kicker`
  string, which is also what the TOC displays, so renumber the remaining
  kickers after a deletion to keep them contiguous. An anchor defaults to the
  filename slug; set the optional `section_id` frontmatter key only to preserve
  an existing deep link. A section that injects a chart or table also needs an
  entry in that page's extras registry, which is renderer code.
  `content/summary.mdx` is imported statically (it feeds the layout hero) and
  is required, as is the currently-orphaned `content/appendix.mdx`.
- Put client-visible images and diagrams in `public/assets/`.
- Splash page hero images live at `public/assets/cover/hero.optimized.png` for the
  initial display image and `public/assets/cover/hero.full.png` for the
  high-resolution modal image. `content/summary.mdx` owns those paths, alt text,
  and caption. Report images open in an in-page modal instead of navigating away.
- Windows page placeholders live under `public/assets/windows/` with paired
  `*.optimized.png` display and `*.full.png` modal images. `content/windows/*.mdx` owns those
  paths, alt text, and captions for project replacement.
- Treat `data/` as generated PHPP output. Run `btwr scrape <project-path>`.
- Keep `.bldgtyp/config.local.yaml` local-only for machine-specific notes.

## Custom Pages

Custom pages let one project append up to two project-specific top-level pages
without putting renderer code in the project repo. Use them for exceptional
material that deserves its own primary-navigation page, such as Resilience,
not for an ordinary section that belongs on an existing core page.

### Contract and boundaries

- `project.yaml` may omit `custom_pages` or register one or two entries. Each
  entry has exactly `slug` and `label`; `schema_version` remains `0.2.0`.
- A slug starts with a lowercase letter and then uses only lowercase letters,
  digits, and single hyphens: `resilience`, `design-notes`. Do not use route
  names reserved by the renderer: `energy_model`, `building_envelope`,
  `windows`, `mechanical`, `print`, `admin`, or `assets`.
- Slugs are unique. The route is derived as `/<slug>/`; authors do not specify
  a separate route.
- Registration and content are a bijection. Every registered slug must have a
  non-empty `content/custom/<slug>/` directory, and every directory directly
  under `content/custom/` must be registered.
- Custom-page section MDX is non-recursive. Put each `.mdx` directly in its
  slug directory; nested custom-page MDX is rejected.
- Registration order is page order. The five core pages stay `00`–`04`;
  custom pages append as `05` and `06`. That same order drives the Summary
  cards, desktop/mobile navigation, next-page links, print TOC, and PDF body.
- Project repos remain content-only. Do not add Astro/TypeScript, `src/`,
  `package.json`, or components to obtain custom behavior.
- Tina does not manage `content/custom/` in v1. Edit custom-page MDX directly.

### Create a prose-only page

Register the page in `project.yaml`:

```yaml
schema_version: 0.2.0
# existing project keys...
custom_pages:
  - slug: design-notes
    label: Design Notes
```

Create one or more top-level section files:

```text
content/custom/design-notes/
├── overview.mdx
└── recommendations.mdx
```

Every section requires a unique `kicker` and a `title`:

```mdx
---
kicker: "01"
title: "Overview"
---

This page records project-specific design guidance.

The certification target is <Var k="narrative.certification.target" />.

![Coordination diagram](/assets/design-notes/coordination-diagram.png)

[Download the supporting calculation](/downloads/design-notes/calculation.pdf)
```

Put images and PDFs under `public/assets/<slug>/` and canonical downloadable
inputs/outputs under `public/downloads/<slug>/`. Reference them with root-based
URLs beginning `/assets/` or `/downloads/`. Do not put specialist inputs in
scrape-owned `data/`; `btwr scrape` replaces that directory.

Section rules:

- Sections sort lexically by the displayed, zero-padded `kicker` (`"01"`,
  `"02"`, …). Kickers must be unique; keep them contiguous by convention.
- The section anchor defaults to `<page-slug>-<filename>`, for example
  `design-notes-overview`. Optional `section_id` overrides the filename part,
  but the renderer still prefixes the page slug. Use it only to preserve an
  intentional deep link.
- `callout_label` plus `callout_body` frontmatter adds the standard callout.
  Both values are required for the callout to render.
- `<Var k="..." />` and `<VarLink hrefKey="...">...</VarLink>` work without
  imports. Keep reusable prose-facing values in `project.yaml` rather than
  hardcoding them in MDX.

### Project-authored interactive embeds

Use the global `<PrintableEmbed>` component when a custom page owns an
interactive web representation and its source application can also emit a
deterministic static print asset. This is a generic web/print switch, not a
chart registry: data, semantics, interactive markup, and SVG/PNG generation
remain project-owned.

```mdx
<PrintableEmbed
  id="summer-heat-index"
  title="Summer Heat Index by zone"
  printSrc="/assets/resilience/summer-heat-index.svg"
  width={1200}
  height={675}
>
  <!-- project-authored interactive HTML -->
</PrintableEmbed>
```

- `id`, `title`, `printSrc`, `width`, and `height` are required. Use a stable
  embed ID and an accessible title that also works as the static image's alt
  text.
- `printSrc` must be a root-relative URL to a project-owned public asset. Put
  reproducibly generated print assets under `public/assets/<slug>/`.
- `width` and `height` are the print asset's positive-integer intrinsic pixel
  dimensions. They reserve the aspect ratio without inline styles.
- Normal web routes emit only the authored children; the print asset does not
  participate in layout or the accessibility tree. `/print` emits only the
  static image, so Paged.js never sees the interactive DOM.
- `btwr build-pdf <project>` fails if the static asset is missing or
  unreadable. The diagnostic names the custom-page slug, embed ID, and asset
  URL.

Do not use `<PrintableEmbed>` to move a reusable platform chart into project
code. A shared chart/table still belongs in the extras registry below. Do not
hand-maintain screenshots; the specialist source application must produce the
static asset through a declared, reproducible step.

### Charts, tables, and other extras

A project may request only components already owned and whitelisted by the
shared template:

```mdx
---
kicker: "02"
title: "Summer Heat Index"
extras:
  - HeatIndexChart
---
```

The current registry is
`src/data/section-extras-components.ts`. Supported names are:

| Extra | Slot | Required project inputs |
| --- | --- | --- |
| `HeatIndexChart` | `Children` | Valid `public/downloads/resilience/resilience.json` and `summer-heat-index.csv` |
| `SetTemperatureChart` | `Children` | Valid `public/downloads/resilience/resilience.json` and `winter-set.csv` |

`extras` must be a list of unique registered names, with at most one component
per slot (`Before` or `Children`). The Resilience components are specialist
components with a strict provenance/data contract; they are not generic CSV
charts.

If a new page needs a new chart/table/figure, stop project authoring and change
the platform first:

1. Add the data loader and component under the template's `src/data/` and
   `src/charts/` or `src/components/` directories.
2. Register a stable public name and slot in
   `src/data/section-extras-components.ts`.
3. Add loader/registry failure tests plus web and print/PDF verification.
4. Merge and verify the template before changing the project.
5. Run `btwr pin <project> --renderer <template-sha> --schemas <schemas-sha>`;
   commit both workflow pin changes with the project content.

Never import a project-local component from MDX, add executable project code,
or turn the registry into an arbitrary component/plugin loader.

### Authoring and release protocol

1. Start from a clean project worktree and confirm the current pins with
   `btwr pin <project> --show`.
2. Register the page and add its content directory in the same change. Add
   assets/downloads and provenance metadata without hand-editing calculated
   source values.
3. Run `btwr preview <project>` and inspect the Summary card, direct route,
   desktop/mobile nav, on-page TOC, previous/next wrap, images, downloads, and
   responsive chart containment.
4. Run `btwr build-pdf <project>`. This validates `project.yaml`, the
   registration/content correspondence, section frontmatter, extras, the
   static route, print composition, and the client PDF.
5. Inspect the generated PDF for TOC order, headings, page breaks, clipping,
   and download/source wording. Cross-check any displayed metric against its
   committed source file.
6. Commit on a project branch, push, and require PR CI to pass. CI adds schema
   validation, type-check, Tina audit, build, PDF, and integration tests.
7. Merge/deploy only after the content and any client-facing conclusions are
   accepted. Verify the production `/<slug>/`, `report.pdf`, and downloads;
   for gated reports, confirm the Cloudflare Access redirect still applies.

For routine project authoring, do not change the template. For a platform
change to the custom-page mechanism, also build a project with no
`custom_pages` and confirm its routes, navigation, and PDF remain unchanged.

### Rename, reorder, or remove

- Reordering `custom_pages` changes navigation order and page kickers. Review
  the web report and PDF before publishing.
- Renaming a slug changes the route and every prefixed section anchor. There
  is no automatic redirect; treat a published rename as a breaking link.
- To remove a page, delete its `project.yaml` entry and its
  `content/custom/<slug>/` directory in the same commit. Leaving either side
  behind fails validation by design.
- Deleting a section removes it from the page, on-page TOC, print body, and
  print TOC. Renumber the remaining section kickers if needed.

### Reference implementation

The first complete example is
[`bldgtyp-projects/bt-proj-2613-ayers-home` at `f05ebf0`](https://github.com/bldgtyp-projects/bt-proj-2613-ayers-home/tree/f05ebf08c0b792abc644f5a5b775fc2c60fad98f):

- `project.yaml` registers `resilience`;
- `content/custom/resilience/` contains three ordered MDX sections;
- `public/downloads/resilience/` contains the provenance sidecar and exact
  chart inputs; and
- both project workflows pin the supporting template and schemas SHAs.

In the platform workspace, the implementation history and the strict
Resilience specialist-data contract are archived under
`planning/archive/dated/2026-07-20/custom-pages/`.

### Common validation failures

| Error text | Fix |
| --- | --- |
| `registered custom page "<slug>" is missing content directory` | Create `content/custom/<slug>/` or remove the registration. |
| `no top-level .mdx sections found in content/custom/<slug>` | Add at least one direct child `.mdx` file. |
| `unregistered custom page content directory` | Register that slug or remove the orphan directory. |
| `nested custom page MDX is not supported` | Move section MDX to the slug directory's top level. |
| `Custom page slug "<slug>" is duplicated` | Keep one registration per slug. |
| `collides with a reserved route` | Choose a non-reserved slug. |
| `missing the required "kicker"` / `Duplicate kicker` | Add a unique zero-padded section kicker. |
| `unknown extra` | Use a current registry name or implement/release the template component first. |
| `both use the Children slot` | Request no more than one extra per slot. |

## Report Routes

The renderer always publishes five core pages, matching the legacy BT report
structure, then appends any registered custom pages:

- `/` - Summary / splash entry point
- `/energy_model/` - Energy Model
- `/building_envelope/` - Envelope
- `/windows/` - Windows
- `/mechanical/` - Mechanical
- `/<custom-page-slug>/` - optional custom page (`05` or `06`)

The masthead is cross-page navigation. The right rail is the table of contents
for the current page.

## TinaCMS Editor

Run the local report editor through the CLI:

```bash
btwr editor /path/to/Project/04_Web
```

The command creates a disposable preview workspace in app support and starts
Tina around Astro dev. The report is served at `http://127.0.0.1:4321/`; the
Tina admin route is `http://127.0.0.1:4321/admin/index.html`, with Tina's local
data server on port `4001`.

This is Tina's basic local form editor. It writes MDX/frontmatter files and the
Astro report preview should hot-reload after saves, but Tina visual/live preview
is not wired in v1. See
`../planning/archive/dated/2026-05-13/phase-6-tinacms-integration.html#visual-live-preview-future-slice`
for the future investigation notes.

PHPP-derived files in `data/` are deliberately not part of the editor schema.

## Project variables and `<Var>`

Prose-facing values that vary per project — energy code name, climate zone,
selected ERV, certification target, climate-specific Passive House limits —
live in `project.yaml` under the `narrative:` block, NOT hardcoded in MDX
files. Authors reference them in MDX via the `<Var>` shortcode:

```mdx
The project targets <Var k="narrative.certification.target" /> under
<Var k="narrative.energy_code.name" /> (<Var k="narrative.energy_code.zone" />),
with an airtightness limit of <Var k="narrative.certification.ph_ach_limit" /> ACH50.
```

Project-specific one-off variables belong under `narrative.user_defined.*`:

```yaml
narrative:
  user_defined:
    cad_received_date: May 1, 2026
```

```mdx
CAD background received <Var k="narrative.user_defined.cad_received_date" />.
```

`narrative.user_defined.*` keys are dynamic, so they are typed directly instead
of appearing in Tina's generated `<Var>` dropdown.

**Resolution rules** (`src/components/Var.astro` → `src/data/resolve-var.ts`):

- The `k` prop is a dot-path into the validated `ProjectConfig` shape.
- Only string-typed leaves resolve. Object containers (e.g. `narrative` or
  `building`) refuse to inline so prose can't accidentally print a whole
  object.
- Missing key in **dev**: renders `[MISSING: narrative.foo.bar]` in place so
  the broken reference is visible while editing.
- Missing key in **production build**: throws — a typo never ships.

**Where it's wired in:**

- `src/middleware/index.ts` loads `project.yaml` once and stashes it on
  `Astro.locals.project`.
- `src/components/ReportSection.astro` passes `{ Var }` into every MDX
  `<Content components={...} />`, so the shortcode works in every section
  without per-page wiring.
- `tina/config.ts` declares a `Var` rich-text template whose `k` field is
  a dropdown auto-generated from `@bldgtyp/web-report-schemas` —
  editors pick a labelled key like `"Climate > Weather Station Name"`,
  Tina writes `<Var k="narrative.climate.weather_station_name" />`.

**Adding a standard variable end-to-end:**

1. Add the field to the Pydantic schema in
   `bt-web-report-schemas/src/bt_web_report_schemas/project.py`.
2. `uv run gen-json-schemas` to regenerate the JSON Schema.
3. Set the value in `project.yaml`.

The TypeScript type (`src/data/project.ts`), ajv validator
(`src/data/project-schema.mjs`), and Tina dropdown all pick it up
automatically — there is no second place to edit. See
[`../bt-web-report-schemas/README.md`](../bt-web-report-schemas/README.md)
for the full flow.

## Data States

The committed seed content is intentionally pending-data:

```json
{ "status": "pending", "variants": [] }
```

That state must build. After scraping, `data/` should contain:
`manifest.json`, `variants.csv`, `climate-monthly.csv`, `room-airflows.csv`,
`building-metrics.csv`, `certification.csv`, `energy.csv`, and
`demand-detail.csv`.

## Deploy

Project repos copy the workflow in `.github/workflows/`. GitHub Actions checks
out the content repo, checks out `bldgtyp/bt-web-report-template` as the shared
renderer, creates or reuses the direct-upload Cloudflare Pages project, adds the
custom domain from `project.yaml`, creates a temporary runtime workspace, builds
`runtime/dist`, and deploys that output to Cloudflare Pages.

Project CI runs `pnpm check:editor` to validate the local Tina schema, but it
does not run `pnpm build:editor`. The Tina admin is a local-only authoring tool
in v1, not a production deploy artifact.

Required organization or repository GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BLDGTYP_PACKAGES_TOKEN` when private `@bldgtyp/*` package access is needed

Project repos are public, so the normal setup is org-level secrets with
visibility that includes public repositories. Repo-level secrets remain useful
only for one-off overrides.

Optional repo variable:

- `CLOUDFLARE_PAGES_PROJECT` (defaults to the GitHub repo name)

Optional organization or repository GitHub Actions secret for gated reports:

- `CLOUDFLARE_ACCESS_OTP_IDP_ID` (required only when `project.yaml` sets
  `publishing.access.mode: cloudflare_access_otp`)

The normal project convention is repo name = Pages project name:
`bt-proj-<number>-<name>`. The client URL remains separate:
`https://project-<number>.bldgtyp.com`.
