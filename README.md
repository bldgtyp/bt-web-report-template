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

## Report Routes

The renderer publishes the client report as five pages, matching the legacy BT
report structure:

- `/` - Summary / splash entry point
- `/energy_model/` - Energy Model
- `/building_envelope/` - Envelope
- `/windows/` - Windows
- `/mechanical/` - Mechanical

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
`../context/plans/2026-05-13/phase-6-tinacms-integration.html#visual-live-preview-future-slice`
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

The normal project convention is repo name = Pages project name:
`bt-proj-<number>-<name>`. The client URL remains separate:
`https://project-<number>.bldgtyp.com`.
