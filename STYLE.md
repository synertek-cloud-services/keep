# Keep — STYLE.md

UI/UX pattern reference, in the spirit of Beacon's `STYLE.md`. Deliberately starting minimal — Beacon's grew to its current size organically, one documented pattern at a time, as real pages were built. This file should grow the same way: when a new reusable pattern is established (a list-page shell, a form-page shell, a filter-chip bar, etc.), document it here with the markup/CSS/script shape, not just leave it implicit in the component that happens to use it first.

## Design tokens

`src/app.css` — ported verbatim from Beacon's `dashboard/src/style.css` token block (`--color-*`, `--r-*`, `--font`, `--mono`, etc.). Keep these two files' values in sync across the product suite.

## Established patterns so far

- **List page shell**: `.section-card` > `.section-card-head` (title + `.row-count-badge`) > plain `<table>`. See `(admin)/users/+page.svelte` once built.
- **Full-page create/edit form shell**: `.pf-page`/`.pf-crumb`/`.pf-topbar`/`.pf-body`/`.pf-group`/`.pf-group-title`. One route serves both create and edit.
- **Modal**: `.modal-backdrop`/`.modal`/`.modal-header`/`.modal-body`/`.modal-footer` — no direct Beacon precedent (Beacon styles modals per-page); defined generically in `app.css` for Keep's API-key reveal-once dialog and confirmations.

Add to this list as pages get built — don't let patterns stay undocumented just because "the code is the source of truth." The whole point of this file (per Beacon's own experience) is to make patterns visible to an AI assistant or new contributor without having to reverse-engineer them from five different pages first.
