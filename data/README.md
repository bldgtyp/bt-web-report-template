# Generated report data

This folder is the handoff point from `btwr scrape`.

The starter commits only `manifest.json` with `status: "pending"`. A scraped
project replaces or adds the Phase 1 files:

- `manifest.json`
- `variants.csv`
- `climate-monthly.csv`
- `room-airflows.csv`
- `building-metrics.csv`
- `certification.csv`
- `energy.csv`
- `demand-detail.csv`

Do not hand-edit PHPP-derived values here. Change the PHPP, run `btwr scrape`,
and commit the generated data.
