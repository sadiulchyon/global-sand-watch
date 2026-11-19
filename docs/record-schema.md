# Global record schema (global-v1)

Every record in `public/data/archive.json` has this shape. Member watches (Bangladesh, Mekong) are mapped into it by adapters in `scripts/adapters.mjs`. Hosted regions (Kenya, Rwanda) store their records directly in this shape in `watches/<id>/archive.json` as `{"schemaVersion": 1, "updated": "YYYY-MM-DD", "records": [...], "sources": [...], "runs": [...]}`.

| Field | Type | Notes |
|---|---|---|
| `gid` | string | Set by the aggregator: `<watch>:<sourceId>`. Not needed in member archives. |
| `watch` | string | Set by the aggregator. |
| `sourceId` / `id` | string | Record ID within its watch or region, stable forever (`BSW-…`, `MSW-…`, `KSW-…`, `RSW-…`). Hosted archives use `id`. |
| `title` | string | Headline in the original language, as published. |
| `titleEn` | string | English headline; empty if `title` is English. Machine-assisted translations must say so in `limitations`. |
| `publisher`, `authors` | string | |
| `category` | enum | `News`, `Research`, `Official`, `Opinion`, `Project`, `Context`. |
| `date` | `YYYY-MM-DD` or `null` | Publication date found in the article or the publisher's own metadata. Never a retrieval date. |
| `dateKind`, `dateEvidence` | string | e.g. `Published`, `Updated`; where the date was read. |
| `language` | string | Source language. |
| `countries` | string[] | Country names as in `public/watches.json`. |
| `basins` | string[] | Basin IDs from `public/watches.json`. |
| `location` | string | Admin units as stated (county/district, sub-county/sector, ward/cell, village). |
| `counties` | string[] | Hosted regions: first-level admin units named in the source (Kenya counties, Rwanda districts). |
| `studyPeriod` | string | Hosted regions: observation or project period, if stated. |
| `rivers` | string[] | Named rivers, channels, wetlands or lakeshores. Omit when not named. |
| `materials` | string[] | `Sand`, `Gravel`, `Stone`, `Soil`, … |
| `topics` | string[] | The watch's own topic labels. |
| `themes` | string[] | Set by the aggregator from `topics`, `materials` and the English title. |
| `summary` | string | English summary following the Bangladesh Sand Watch editorial policy (place, figures, attribution). |
| `hasLocalSummary` | boolean | A local-language summary exists on the member site. |
| `limitations` | string | Source limits, allegations, translation status, assumptions. |
| `url`, `doi` | string | Original source link; DOI without the `https://doi.org/` prefix. |
| `review` | string | `Accepted by member watch`, `Member review pending`, or for hosted regions `Owner review pending` / `Accepted`. |
| `reviewDetail` | string | How it was reviewed. |
| `collectedAt` | `YYYY-MM-DD` | When the member watch collected it. |
| `alsoIn` | string[] | Set by the aggregator when another watch files the same URL. |

Rules that apply to every watch: keep original titles and dates; never take figures from search snippets; attribute allegations; record a null date rather than invent one; count repeated coverage of one incident as one incident in analysis, not in the archive.
