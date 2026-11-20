# Global Sand Watch

One searchable archive of source-backed evidence on river sand extraction, by river basin and country. It combines independent member watches with countries that Global Sand Watch collects itself.

Live site: https://sadiulchyon.github.io/global-sand-watch/

| Source | Basin(s) | How it gets here |
|---|---|---|
| [Bangladesh Sand Watch](https://sadiulchyon.github.io/bangladesh-sand-watch/) | Ganges–Brahmaputra–Meghna; SE Bangladesh hill rivers | Member watch, synced daily |
| [Mekong Sand Watch](https://sadiulchyon.github.io/mekong-sand-watch/) | Mekong | Member watch, synced daily |
| **Kenya** | Athi, Tana, Lake Victoria (KE), Rift Valley, Ewaso Ng'iro North, national | Hosted here: [plan](watches/kenya/collection-plan.json), [data](watches/kenya/archive.json), daily collector |
| **Rwanda** | Nile and Congo headwaters, national | Hosted here: [plan](watches/rwanda/collection-plan.json), [data](watches/rwanda/archive.json), daily collector |

Member watches stay independent: each keeps its own collector, editorial policy, secrets, site and repository, and Global Sand Watch only reads their published `data/archive.json`. Hosted regions live entirely in this repository under `watches/<country>/`.

## Run locally

Node 22+; the site needs no packages.

```sh
node scripts/sync.mjs     # member archives + hosted regions -> public/data/archive.json
node scripts/check.mjs    # validate registry, archives, adapters, collector helpers
node scripts/serve.mjs    # http://127.0.0.1:4173/
node scripts/build-pages.mjs   # static site in _site/
```

`node scripts/sync.mjs --from DIR` reads member archives from `DIR/<watch-id>.json` instead of fetching. Hosted regions are always read from `watches/<id>/archive.json`.

## How it works

- `public/watches.json` is the registry of watches, hosted regions and basins (countries, coverage, map pins, notes).
- `scripts/adapters.mjs` maps each member watch's schema to the [global record schema](docs/record-schema.md). Summaries, dates, figures and review decisions are copied unchanged. It also adds:
  - river-name normalisation for facets (e.g. `Padma River` → `Padma`, `sông Hậu` → `Hau / Bassac`);
  - a small, rule-based **theme** index (12 themes) so basins can be compared;
  - a heuristic basin split for Bangladesh: Karnaphuli, Halda, Sangu, Matamuhuri, Bakkhali, Naf and Maheshkhali records go to the SE hill-rivers basin, the rest to GBM.
- Bangladesh records are included only when accepted by that watch. Mekong and Kenya records show their review status (mostly pending owner review) on every record.
- If a member watch cannot be fetched, its previous records are kept and it is marked stale.
- The same URL filed by two sources is kept in both and linked with `alsoIn`.

## Hosted regions (Kenya, Rwanda)

Each hosted region has, under `watches/<id>/`:

- `collection-plan.json`: scope, basin areas, counties/districts, rivers, search terms, sources, editorial notes;
- `collector.json`: what the daily collector uses (basins, admin units, river vocabulary, searches, editorial prompt parts);
- `archive.json`: the region's records in the global schema, source registry and run history;
- `collection-runs/`: the collector's audit logs (source-body hashes, date and figure quotes, outcomes).

Kenya records are filed by the Water Resources Authority basin area of their named river and list the counties they name; Kenya-wide material goes to "Kenya (national scope)".

`collector/collect.mjs` (adapted from the Mekong Sand Watch collector) runs from `.github/workflows/collect.yml` daily at 16:20 UTC, or by hand with `region`, `max_records` and `dry_run`. It searches (TinyFish), reads each original page (TinyFish, direct read, then a capped Firecrawl fallback), has Claude draft a record whose date and figure quotes must appear verbatim in the article, and requires a second Claude review before saving. It needs repository secrets `ANTHROPIC_API_KEY` and `TINYFISH_API_KEY` (`FIRECRAWL_API_KEY` optional); without them it fails safely and saves nothing.

## Deployment

`.github/workflows/pages.yml` runs daily at 17:30 UTC (after the Bangladesh 14:40, Mekong 15:40 and Kenya 16:20 collectors), on manual dispatch, and on push. Every run syncs, checks, commits changed data, builds and deploys to GitHub Pages. Settings → Pages → Source is set to **GitHub Actions**.

## Adding a country or watch

- **New country (hosted):** add it and its basins to `public/watches.json` with `hosted: true` and `archivePath`, then create `watches/<id>/` with a plan, collector config and empty archive. Set `status: "live"` once it has records.
- **Existing independent watch:** add it with its public `archiveUrl` and an adapter in `scripts/adapters.mjs`.

## Map data

`public/world-shapes.js` is built by `scripts/map/build-world.py` from Natural Earth 1:110m admin-0 countries v5.1.2 (public domain, checksum-verified, same file as Mekong Sand Watch). Basin pins are approximate positions, not basin outlines or extraction sites.

## Limits

Counts are of sources, not mining incidents. Coverage is uneven: Bangladesh is the only GBM country covered, the Mekong collection leans toward Viet Nam, Kenya (mostly English-language press, with little from the north and north-east) and Rwanda (mostly Kigali Today and Kinyarwanda press) are agent-collected seed archives still awaiting owner review, and countries not yet covered show no records. Acceptance is not independent verification.
