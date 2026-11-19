# Global Sand Watch

One searchable archive of source-backed evidence on river sand extraction, aggregated from independent national and basin watches.

| Watch | Basin(s) | Status | Records |
|---|---|---|---|
| [Bangladesh Sand Watch](https://sadiulchyon.github.io/bangladesh-sand-watch/) | Ganges–Brahmaputra–Meghna; SE Bangladesh hill rivers | Live | synced daily |
| [Mekong Sand Watch](https://sadiulchyon.github.io/mekong-sand-watch/) | Mekong | Live | synced daily |
| Kenya Sand Watch | Athi, Tana, Lake Victoria (KE), Rift Valley, Ewaso Ng'iro North | Planned: [collection plan](watches/kenya/collection-plan.json) | none yet |
| Rwanda Sand Watch | Nile and Congo headwaters | Planned: [collection plan](watches/rwanda/collection-plan.json) | none yet |

Member watches stay independent: each keeps its own collector, editorial policy, secrets, site and repository. Global Sand Watch only reads their published `data/archive.json`.

## Run locally

Node 22+; no packages to install.

```sh
node scripts/sync.mjs     # fetch member archives -> public/data/archive.json
node scripts/check.mjs    # validate registry, archive, adapters, helpers
node scripts/serve.mjs    # http://127.0.0.1:4173/
node scripts/build-pages.mjs   # static site in _site/
```

`node scripts/sync.mjs --from DIR` reads `DIR/<watch-id>.json` instead of fetching.

## How it works

- `public/watches.json` is the registry of watches and basins (countries, coverage, map pins, notes).
- `scripts/adapters.mjs` maps each watch's schema to the [global record schema](docs/record-schema.md). Summaries, dates, figures and review decisions are copied unchanged. It also adds:
  - river-name normalisation for facets (e.g. `Padma River` → `Padma`, `sông Hậu` → `Hau / Bassac`);
  - a small, rule-based **theme** index (12 themes) so basins can be compared;
  - a heuristic basin split for Bangladesh: Karnaphuli, Halda, Sangu, Matamuhuri, Bakkhali, Naf and Maheshkhali records go to the SE hill-rivers basin, the rest to GBM.
- Bangladesh records are included only when accepted by that watch. Mekong records are included with their review status (most are pending owner and native-language review), shown on every record.
- If a watch cannot be fetched, its previous records are kept and it is marked stale.
- The same URL filed by two watches is kept in both and linked with `alsoIn`.

## Deployment

`.github/workflows/pages.yml` runs daily at 17:30 UTC (after the Bangladesh 14:40 and Mekong 15:40 collectors), on manual dispatch, and on push. Every run syncs, checks, commits changed data, builds and deploys to GitHub Pages. No secrets are needed.

One-time setup: create the `sadiulchyon/global-sand-watch` repository, push `main`, then Settings → Pages → Source: **GitHub Actions**.

## Adding a watch

1. Add the watch and its basins to `public/watches.json` (`status: "planned"` until it publishes).
2. Publish a static `archive.json` in the global schema (`adapter: "global-v1"`), or write an adapter.
3. Set `status: "live"` and `archiveUrl`; run `sync` and `check`.

Kenya and Rwanda plans list basins, counties/districts, rivers, search terms in English, Swahili, Kinyarwanda and French, starting sources and editorial notes. They are drafts: no records have been collected.

## Map data

`public/world-shapes.js` is built by `scripts/map/build-world.py` from Natural Earth 1:110m admin-0 countries v5.1.2 (public domain, checksum-verified, same file as Mekong Sand Watch). Basin pins are approximate positions, not basin outlines or extraction sites.

## Limits

Counts are of sources, not mining incidents. Coverage is uneven: Bangladesh is the only GBM country covered, the Mekong collection leans toward Viet Nam, and countries without a watch show no records. Member acceptance is not independent verification.
