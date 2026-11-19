// Pure helpers shared by the browser app and scripts/check.mjs.
// Search normalisation, filtering, sorting and CSV escaping follow the member watches' utilities.

export function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/đ/g, 'd').replace(/\b(vietnam|viet nam)\b/g, 'viet nam')
    .replace(/\b(laos|lao pdr)\b/g, 'lao pdr').replace(/\s+/g, ' ').trim();
}

export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
}

export const FILTER_KEYS = ['q', 'watch', 'basin', 'country', 'category', 'theme', 'language', 'river', 'review', 'from', 'to'];

const searchCache = new WeakMap();
function corpus(r) {
  let c = searchCache.get(r);
  if (!c) {
    c = normalize([r.gid, r.title, r.titleEn, r.publisher, r.authors, r.summary, r.location,
      r.countries.join(' '), r.rivers.join(' '), r.topics.join(' '), r.themes.join(' '),
      r.materials.join(' '), r.doi].join(' '));
    searchCache.set(r, c);
  }
  return c;
}

export function matches(r, f, skip) {
  const terms = skip === 'q' ? [] : normalize(f.q).split(' ').filter(Boolean);
  if (terms.length) { const c = corpus(r); if (!terms.every(t => c.includes(t))) return false; }
  const is = (key, test) => skip === key || !f[key] || test(f[key]);
  return is('watch', v => r.watch === v) &&
    is('basin', v => r.basins.includes(v)) &&
    is('country', v => r.countries.includes(v)) &&
    is('category', v => r.category === v) &&
    is('theme', v => r.themes.includes(v)) &&
    is('language', v => r.language === v) &&
    is('river', v => r.rivers.includes(v)) &&
    is('review', v => r.review === v) &&
    is('from', v => Boolean(r.date) && r.date.slice(0, 4) >= v) &&
    is('to', v => Boolean(r.date) && r.date.slice(0, 4) <= v);
}

export function filterRecords(records, f = {}) {
  return records.filter(r => matches(r, f));
}

// Counts for one facet given every other active filter (so options never lead to zero results).
export function facetCounts(records, f, key, valuesOf) {
  const counts = new Map();
  for (const r of records) {
    if (!matches(r, f, key)) continue;
    for (const v of valuesOf(r)) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function sortRecords(records, sort = 'newest') {
  return [...records].sort((a, b) => {
    if (sort === 'title') return (a.titleEn || a.title).localeCompare(b.titleEn || b.title);
    if (!a.date && !b.date) return a.gid.localeCompare(b.gid);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return (sort === 'oldest' ? 1 : -1) * a.date.localeCompare(b.date) || a.gid.localeCompare(b.gid);
  });
}

export function csv(rows) {
  const cell = value => {
    let s = String(value ?? '');
    if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

export const CSV_COLUMNS = [
  ['Global ID', r => r.gid], ['Watch', r => r.watch], ['Watch record ID', r => r.sourceId],
  ['Basins', r => r.basins.join('; ')], ['Countries', r => r.countries.join('; ')],
  ['Location', r => r.location], ['Rivers', r => r.rivers.join('; ')],
  ['Title (original)', r => r.title], ['Title (English)', r => r.titleEn],
  ['Publisher', r => r.publisher], ['Category', r => r.category], ['Date', r => r.date || ''],
  ['Date kind', r => r.dateKind], ['Language', r => r.language], ['Themes (derived)', r => r.themes.join('; ')],
  ['Topics (member)', r => r.topics.join('; ')], ['Materials', r => r.materials.join('; ')],
  ['English summary', r => r.summary], ['Limitations', r => r.limitations],
  ['Review status', r => r.review], ['URL', r => r.url], ['DOI', r => r.doi]
];

export function dateLabel(r) {
  return r.date ? new Intl.DateTimeFormat('en', {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'})
    .format(new Date(r.date + 'T12:00:00Z')) : 'Date unverified';
}
