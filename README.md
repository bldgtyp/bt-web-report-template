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
├── pnpm-store/
├── builds/<slug>/
├── previews/<slug>/
└── cache/
```

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

## Project Edit Boundaries

- Edit `project.yaml` for project metadata, publish URL, and local data paths.
- Edit `content/**/*.mdx` for report narrative.
- Put client-visible images and diagrams in `public/assets/`.
- Treat `data/` as generated PHPP output. Run `btwr scrape <project-path>`.
- Keep `.bldgtyp/config.local.yaml` local-only for machine-specific notes.

## TinaCMS Editor

Run the local report editor through the CLI:

```bash
btwr editor /path/to/Project/04_Web
```

The command creates a disposable preview workspace in app support and starts
Tina around Astro dev. The report is served at `http://127.0.0.1:4321/`; the
Tina admin route is `http://127.0.0.1:4321/admin/index.html`, with Tina's local
data server on port `4001`.

PHPP-derived files in `data/` are deliberately not part of the editor schema.

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
renderer, creates a temporary runtime workspace, builds `runtime/dist`, and
deploys that output to Cloudflare Pages.

Required GitHub repo or org secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BLDGTYP_PACKAGES_TOKEN` when private `@bldgtyp/*` package access is needed

Optional repo variable:

- `CLOUDFLARE_PAGES_PROJECT` (defaults to the GitHub repo name)
