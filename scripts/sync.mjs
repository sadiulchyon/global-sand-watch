// Pull every live member watch's public archive and rebuild public/data/archive.json.
//
//   node scripts/sync.mjs                 fetch from each watch's archiveUrl
//   node scripts/sync.mjs --from DIR      read DIR/<watch-id>.json instead (offline / testing)
//
// If one watch cannot be fetched or parsed, its records from the previous global archive
// are kept and the watch is marked stale, so a single outage never empties the archive.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adapt} from './adapters.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = JSON.parse(readFileSync(path.join(root, 'public/watches.json'), 'utf8'));
const outFile = path.join(root, 'public/data/archive.json');
const fromIndex = process.argv.indexOf('--from');
const fromDir = fromIndex > -1 ? path.resolve(process.argv[fromIndex + 1]) : null;
const previous = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {records: [], watches: []};

async function load(watch) {
  if (fromDir) {
    const file = path.join(fromDir, `${watch.id}.json`);
    const body = readFileSync(file);
    return {body, origin: file};
  }
  const url = `${watch.archiveUrl}?t=${Date.now()}`;
  const response = await fetch(url, {headers: {'User-Agent': 'global-sand-watch-sync', Accept: 'application/json'}});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {body: Buffer.from(await response.arrayBuffer()), origin: watch.archiveUrl};
}

function canonicalUrl(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    return (u.host.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search).toLowerCase();
  } catch { return ''; }
}

const now = new Date().toISOString();
const records = [];
const watchStatus = [];
for (const watch of registry.watches) {
  const base = {id: watch.id, status: watch.status, records: 0};
  if (watch.status !== 'live' || !watch.archiveUrl) { watchStatus.push(base); continue; }
  try {
    const {body, origin} = await load(watch);
    const archive = JSON.parse(body.toString('utf8'));
    const {records: adapted, excluded} = adapt(archive, watch);
    records.push(...adapted);
    watchStatus.push({
      ...base, records: adapted.length, excluded,
      upstreamUpdated: archive.updated || archive.runs?.[0]?.finishedAt?.slice(0, 10) || null,
      upstreamRecords: archive.records.length,
      sha256: createHash('sha256').update(body).digest('hex'),
      fetchedAt: now, origin, stale: false
    });
    console.log(`${watch.id}: ${adapted.length} records${excluded ? ` (${excluded} excluded by decision)` : ''}`);
  } catch (error) {
    const kept = previous.records.filter(r => r.watch === watch.id);
    const prior = previous.watches?.find(w => w.id === watch.id) || {};
    records.push(...kept);
    watchStatus.push({...prior, ...base, records: kept.length, stale: true, error: String(error.message || error)});
    console.warn(`::warning::${watch.id}: ${error.message || error}; kept ${kept.length} previous records`);
  }
}

// The same article can be filed by two watches (e.g. a regional story). Keep both records,
// since each watch's summary and review are its own, but link them so counts can be read carefully.
const byUrl = new Map();
for (const r of records) {
  const key = canonicalUrl(r.url);
  if (!key) continue;
  if (!byUrl.has(key)) byUrl.set(key, []);
  byUrl.get(key).push(r);
}
let crossWatch = 0;
for (const group of byUrl.values()) {
  const watches = new Set(group.map(r => r.watch));
  if (watches.size < 2) continue;
  crossWatch++;
  for (const r of group) r.alsoIn = group.filter(o => o !== r).map(o => o.gid);
}

records.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.gid.localeCompare(b.gid));
const archive = {
  schemaVersion: 1,
  updated: now.slice(0, 10),
  syncedAt: now,
  watches: watchStatus,
  crossWatchDuplicates: crossWatch,
  records
};
mkdirSync(path.dirname(outFile), {recursive: true});
writeFileSync(outFile, JSON.stringify(archive) + '\n');
console.log(`Wrote ${records.length} records from ${watchStatus.filter(w => w.records).length} watches; ${crossWatch} URLs shared across watches.`);
if (watchStatus.some(w => w.stale)) process.exitCode = 0; // stale data is reported, not fatal
