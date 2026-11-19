// Validate the registry, the aggregated archive, the adapters and the browser helpers.
// Run before every build: node scripts/check.mjs
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adapt, riverFacet, themesFor, CATEGORIES} from './adapters.mjs';
import {csv, filterRecords, facetCounts, normalize, safeUrl, sortRecords} from '../public/core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(path.join(root, p), 'utf8');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// Registry
const registry = JSON.parse(read('public/watches.json'));
const basinIds = new Set(registry.basins.map(b => b.id));
ok(basinIds.size === registry.basins.length, 'basin ids are unique');
ok(new Set(registry.watches.map(w => w.id)).size === registry.watches.length, 'watch ids are unique');
for (const w of registry.watches) {
  ok(['live', 'planned', 'paused'].includes(w.status), `${w.id}: known status`);
  ok(w.basins.every(b => basinIds.has(b)) && basinIds.has(w.defaultBasin), `${w.id}: basins exist`);
  if (w.archivePath) {
    ok(w.hosted && existsSync(path.join(root, w.archivePath)), `${w.id}: hosted archive file exists`);
    const hostedArchive = JSON.parse(read(w.archivePath));
    ok(hostedArchive.schemaVersion === 1 && Array.isArray(hostedArchive.records), `${w.id}: hosted archive shape`);
    for (const r of hostedArchive.records) {
      ok(new RegExp(`^${w.prefix}-\\d{3,}$`).test(r.id), `${w.id}: record id ${r.id}`);
      ok(r.countries.every(c => w.countries.includes(c)) && r.basins.every(b => w.basins.includes(b)), `${r.id}: country and basin belong to ${w.id}`);
      ok(r.date === null ? /unverified/i.test(r.dateKind) : /\S/.test(r.dateEvidence), `${r.id}: date has evidence or is marked unverified`);
      ok(typeof r.review === 'string' && r.review && typeof r.summary === 'string' && r.summary.length > 40, `${r.id}: review and summary`);
    }
    if (hostedArchive.records.length) ok(w.status === 'live', `${w.id}: has records so status should be live`);
  } else if (w.status === 'live') ok(safeUrl(w.archiveUrl) && safeUrl(w.siteUrl), `${w.id}: live watch has archive and site URLs`);
  if (w.collectionPlan) {
    ok(existsSync(path.join(root, w.collectionPlan)), `${w.id}: collection plan file exists`);
    const plan = JSON.parse(read(w.collectionPlan));
    ok(plan.watch === w.id && plan.basins.every(b => basinIds.has(b.id)), `${w.id}: plan matches registry`);
  }
}
for (const b of registry.basins) {
  ok(b.covered.every(c => b.countries.includes(c)), `${b.id}: covered countries are basin countries`);
  ok(b.pin.length === 2 && Math.abs(b.pin[0]) <= 180 && Math.abs(b.pin[1]) <= 90, `${b.id}: pin is lon/lat`);
}

// Archive
const archive = JSON.parse(read('public/data/archive.json'));
const watchIds = new Set(registry.watches.map(w => w.id));
const gids = new Set();
for (const r of archive.records) {
  ok(!gids.has(r.gid), `unique gid ${r.gid}`); gids.add(r.gid);
  ok(watchIds.has(r.watch) && r.gid === `${r.watch}:${r.sourceId}`, `${r.gid}: watch and gid agree`);
  ok(r.basins.length && r.basins.every(b => basinIds.has(b)), `${r.gid}: known basin`);
  ok(CATEGORIES.includes(r.category), `${r.gid}: known category ${r.category}`);
  ok(r.date === null || /^\d{4}-\d{2}-\d{2}$/.test(r.date), `${r.gid}: ISO date or null`);
  ok(typeof r.title === 'string' && r.title.trim(), `${r.gid}: has title`);
  ok(typeof r.summary === 'string', `${r.gid}: summary is text`);
  ok(!r.url || safeUrl(r.url), `${r.gid}: url is http(s)`);
  for (const k of ['countries', 'rivers', 'topics', 'themes', 'materials']) ok(Array.isArray(r[k]), `${r.gid}: ${k} is a list`);
}
for (const w of archive.watches) {
  const n = archive.records.filter(r => r.watch === w.id).length;
  ok(n === w.records, `${w.id}: record count matches status (${n})`);
  const reg = registry.watches.find(x => x.id === w.id);
  if (reg?.status === 'live' && !w.stale) ok(w.records > 0, `${w.id}: live watch contributed records`);
}

// Adapters on fixtures
const bdWatch = registry.watches.find(w => w.id === 'bangladesh');
const bd = adapt({records: [
  {id: 'BSW-1', type: 'Lease', source: 'X', title: 'বালু', titleEn: 'Sand', date: '2026-01-02', district: 'Chattogram', river: 'Halda River; Karnaphuli', material: 'Sand; soil', topics: 'Lease; illegal extraction', language: 'Bangla', en: 'E', bn: 'B', url: 'https://example.org/a', decision: 'Accept'},
  {id: 'BSW-2', type: 'News', source: 'Y', title: 'T', date: '', river: 'No river named', material: 'Stone', topics: '', language: 'English', en: 'E', url: 'https://example.org/b', decision: 'Reject'}
]}, bdWatch);
ok(bd.records.length === 1 && bd.excluded === 1, 'Bangladesh adapter keeps accepted records only');
ok(bd.records[0].category === 'Official' && bd.records[0].basins[0] === 'se-bangladesh-hill-rivers', 'Bangladesh lease and SE basin mapping');
ok(bd.records[0].rivers.join() === 'Halda,Karnaphuli', 'river names are normalised and split');
ok(bd.records[0].themes.includes('Leasing & licensing') && bd.records[0].themes.includes('Illegal extraction'), 'themes derived');
const reviewed = adapt({records: [{id: 'BSW-3', type: 'News', title: 'T', river: '', decision: 'Pending'}], reviews: {'BSW-3': {decision: 'Accept'}}}, bdWatch);
ok(reviewed.records.length === 1, 'shared review decisions override record decisions');
const mk = adapt({records: [{id: 'MSW-1', title: 'Eng', originalTitle: 'Orig', category: 'News', date: null, countries: ['Viet Nam'], rivers: ['sông Hậu', 'Mekong River'], topics: ['riverbank erosion'], summary: 'S', editorialStatus: 'Pilot — awaiting owner review', url: 'https://example.org/c'}]}, registry.watches.find(w => w.id === 'mekong'));
ok(mk.records[0].title === 'Orig' && mk.records[0].titleEn === 'Eng', 'Mekong titles: original and English');
ok(mk.records[0].rivers.join() === 'Hau / Bassac,Mekong', 'Mekong river aliases merge');
ok(mk.records[0].review === 'Member review pending', 'Mekong pending review is preserved');
ok(riverFacet('Not named') === '' && riverFacet('Padma River') === 'Padma', 'river facet cleanup');
ok(!themesFor('Erosion threatens the river').includes('Violence & intimidation'), 'threatens is not violence');

// Browser helpers
const recs = archive.records;
ok(filterRecords(recs, {basin: 'mekong'}).every(r => r.watch === 'mekong'), 'basin filter');
ok(filterRecords(recs, {q: 'vietnam'}).length === filterRecords(recs, {q: 'Viet Nam'}).length, 'country aliases in search');
ok(normalize('Tiền') === 'tien', 'diacritics folded');
const sorted = sortRecords(recs, 'newest');
ok(sorted.findIndex(r => !r.date) === -1 || sorted.slice(sorted.findIndex(r => !r.date)).every(r => !r.date), 'undated records sort last');
const fc = facetCounts(recs, {basin: 'gbm'}, 'basin', r => r.basins);
ok(fc.some(([v]) => v === 'mekong'), 'facet counts ignore their own filter');
ok(csv([['=SUM(1)', 'a"b']]) === '﻿"\'=SUM(1)","a""b"', 'CSV escapes formulas and quotes');
ok(safeUrl('javascript:alert(1)') === '', 'unsafe URLs rejected');

// Collector helpers (the collector itself needs API keys and runs in GitHub Actions)
const {focusedSearch, interleave, canonicalUrl} = await import('../collector/search-plan.mjs');
const {titleContainsGoldMining} = await import('../collector/editorial-rules.mjs');
ok(focusedSearch(['a', 'b'], 3) === 'b' && focusedSearch([], 1) === null, 'rotating focus search');
ok(interleave([['a1', 'a2'], ['b1']]).join() === 'a1,b1,a2', 'interleave search results');
ok(canonicalUrl('https://example.org/a/?utm_source=x#y') === 'https://example.org/a', 'canonical URLs');
ok(titleContainsGoldMining('Uchimbaji wa dhahabu Migori') && !titleContainsGoldMining('Sand is the new gold for Makueni youth'), 'gold-mining screen');
for (const w of registry.watches.filter(w => w.hosted && existsSync(path.join(root, `watches/${w.id}/collector.json`)))) {
  const c = JSON.parse(read(`watches/${w.id}/collector.json`));
  ok(c.watch === w.id && c.idPrefix === w.prefix && c.basins.every(b => w.basins.includes(b.id)), `${w.id}: collector config matches registry`);
}

// Static assets referenced by the page
const html = read('public/index.html');
for (const ref of ['styles.css', 'app.js', 'assets/mark.svg']) ok(html.includes(ref) && existsSync(path.join(root, 'public', ref)), `asset ${ref}`);
ok(existsSync(path.join(root, 'public/world-shapes.js')), 'world shapes built');

console.log(`${checks} checks passed · ${recs.length} records · ${archive.watches.filter(w => w.records).length} contributing watches`);
