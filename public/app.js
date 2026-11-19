import {FILTER_KEYS, CSV_COLUMNS, csv, dateLabel, facetCounts, filterRecords, safeUrl, sortRecords} from './core.js';
import {WORLD, countryShapes} from './world-shapes.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = n => new Intl.NumberFormat('en').format(n);
const PAGE = 40;
const WATCH_COLORS = {bangladesh: 'var(--c-bd)', mekong: 'var(--c-mk)', kenya: 'var(--c-ke)', rwanda: 'var(--c-rw)'};
const VIEWS = {world: [0, 0, WORLD.width, WORLD.height], asia: [], africa: []};

const state = {records: [], registry: null, archive: null, filters: {}, sort: 'newest', shown: PAGE};

function project([lon, lat]) { return [(lon + 180) * WORLD.k, (WORLD.lat0 - lat) * WORLD.k]; }
function box(lon0, lat1, lon1, lat0) { const [x0, y0] = project([lon0, lat1]); const [x1, y1] = project([lon1, lat0]); return [x0, y0, x1 - x0, y1 - y0]; }
VIEWS.asia = box(62, 40, 122, 2);
VIEWS.africa = box(22, 9, 48, -10);

async function load() {
  const [registry, archive] = await Promise.all(['watches.json', 'data/archive.json'].map(u => fetch(u, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(u); return r.json(); })));
  state.registry = registry;
  state.archive = archive;
  state.records = archive.records;
  state.watchById = Object.fromEntries(registry.watches.map(w => [w.id, w]));
  state.basinById = Object.fromEntries(registry.basins.map(b => [b.id, b]));
}

/* ---------- hero ---------- */
function renderStats() {
  const r = state.records;
  const live = state.registry.watches.filter(w => w.status === 'live');
  const basins = new Set(r.flatMap(x => x.basins));
  const countries = new Set(r.flatMap(x => x.countries));
  const languages = new Set(r.map(x => x.language).filter(Boolean));
  $('#s-records').textContent = fmt(r.length);
  $('#s-watches').textContent = `${live.length} of ${state.registry.watches.length}`;
  $('#s-basins').textContent = basins.size;
  $('#s-countries').textContent = countries.size;
  $('#s-languages').textContent = languages.size;
  const stale = state.archive.watches.filter(w => w.stale).map(w => state.watchById[w.id]?.name);
  $('#synced').textContent = `Updated with member watches and hosted regions on ${dateLabel({date: state.archive.updated})}.` + (stale.length ? ` Stale: ${stale.join(', ')}.` : '');
}

/* ---------- map ---------- */
function renderMap() {
  const svg = $('#world');
  const counts = new Map();
  for (const r of state.records) for (const c of r.countries) counts.set(c, (counts.get(c) || 0) + 1);
  const planned = new Set(state.registry.watches.filter(w => w.status !== 'live').flatMap(w => w.countries));
  const steps = [1, 25, 100, 300, 1000];
  const level = n => n ? steps.filter(s => n >= s).length : 0;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  for (const [name, d] of Object.entries(countryShapes)) {
    const p = document.createElementNS(ns, 'path');
    const n = counts.get(name) || 0;
    p.setAttribute('d', d);
    p.setAttribute('class', `land l${level(n)}${planned.has(name) ? ' planned' : ''}`);
    p.dataset.name = name;
    p.dataset.count = n;
    if (n) { p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button'); p.setAttribute('aria-label', `${name}: ${n} records`); }
    g.append(p);
  }
  svg.append(g);
  const pins = document.createElementNS(ns, 'g');
  for (const b of state.registry.basins) {
    const [x, y] = project(b.pin);
    const n = state.records.filter(r => r.basins.includes(b.id)).length;
    const a = document.createElementNS(ns, 'g');
    a.setAttribute('class', `pin ${n ? 'live' : 'planned'}`);
    a.setAttribute('transform', `translate(${x} ${y})`);
    a.setAttribute('tabindex', '0');
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', `${b.name} basin: ${n ? `${n} records` : 'watch in preparation'}`);
    a.dataset.basin = b.id;
    a.innerHTML = `<circle data-r="${n ? 4 + Math.sqrt(n) / 6 : 3.2}"/>`;
    pins.append(a);
  }
  svg.append(pins);
  setView('world');

  const tip = $('#map-tip');
  const show = (e, html) => {
    tip.innerHTML = html; tip.hidden = false;
    const rect = $('.map-figure').getBoundingClientRect();
    const t = e.target.getBoundingClientRect();
    tip.style.left = `${Math.min(rect.width - 220, Math.max(0, t.left - rect.left + t.width / 2 - 100))}px`;
    tip.style.top = `${t.top - rect.top - 8}px`;
  };
  const describe = el => {
    const pin = el.closest('.pin');
    if (pin) {
      const b = state.basinById[pin.dataset.basin];
      const n = state.records.filter(r => r.basins.includes(b.id)).length;
      return `<strong>${esc(b.name)}</strong><span>${n ? `${fmt(n)} records` : 'Watch in preparation'}</span>`;
    }
    if (el.classList?.contains('land')) {
      const n = +el.dataset.count;
      return `<strong>${esc(el.dataset.name)}</strong><span>${n ? `${fmt(n)} records` : planned.has(el.dataset.name) ? 'Watch in preparation' : 'No member watch yet'}</span>`;
    }
    return '';
  };
  const act = el => {
    const pin = el.closest('.pin');
    if (pin) return openFilter({basin: pin.dataset.basin});
    if (el.classList?.contains('land') && +el.dataset.count) openFilter({country: el.dataset.name});
  };
  svg.addEventListener('pointerover', e => { const h = describe(e.target); if (h) show(e, h); else tip.hidden = true; });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('focusin', e => { const h = describe(e.target); if (h) show(e, h); });
  svg.addEventListener('focusout', () => { tip.hidden = true; });
  svg.addEventListener('click', e => act(e.target));
  svg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e.target); } });
  document.querySelectorAll('[data-map-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.mapView)));

  $('#legend').innerHTML = ['1–24', '25–99', '100–299', '300–999', '1,000+'].map((t, i) => `<i class="sw l${i + 1}"></i>${t}`).join('') +
    '<i class="sw planned"></i>watch in preparation';
}

function setView(view) {
  $('#world').setAttribute('viewBox', VIEWS[view].join(' '));
  // Keep pins a similar on-screen size when zooming into a region.
  const factor = Math.pow(VIEWS[view][2] / WORLD.width, 0.7);
  document.querySelectorAll('.pin circle').forEach(c => c.setAttribute('r', (c.dataset.r * factor).toFixed(2)));
  $('#world').dataset.view = view;
  document.querySelectorAll('[data-map-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapView === view)));
}

/* ---------- basins ---------- */
function themeShares(records) {
  const counts = new Map();
  for (const r of records) for (const t of r.themes) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBasins() {
  const order = state.registry.basins;
  $('#basin-grid').innerHTML = order.map(b => {
    const recs = state.records.filter(r => r.basins.includes(b.id));
    const watches = state.registry.watches.filter(w => w.basins.includes(b.id));
    const live = recs.length > 0;
    const top = themeShares(recs).slice(0, 3).map(([t]) => `<li>${esc(t)}</li>`).join('');
    const years = recs.map(r => r.date?.slice(0, 4)).filter(Boolean).sort();
    const span = years.length ? `${years[0]}–${years.at(-1)}` : '';
    const missing = b.countries.filter(c => !b.covered.includes(c));
    const watchLinks = watches.map(w => w.hosted
      ? `<span class="hosted">Hosted here</span> · <a href="${esc(planUrl(w))}">collection plan</a>`
      : w.siteUrl ? `<a href="${esc(w.siteUrl)}">${esc(w.name)}</a>` : `<a href="${esc(planUrl(w))}">${esc(w.name)} plan</a>`).join(' · ');
    return `<article class="basin ${live ? 'is-live' : 'is-planned'}">
      <header><span class="chip">${live ? 'Live' : 'In preparation'}</span><span class="region">${esc(b.region)}</span></header>
      <h3>${esc(b.name)}</h3>
      ${live ? `<p class="big"><strong>${fmt(recs.length)}</strong> records <span>${esc(span)}</span></p>` : `<p class="big muted">No records collected yet</p>`}
      <p class="cover">Countries: ${b.countries.map(c => `<span class="${b.covered.includes(c) ? 'on' : 'off'}">${esc(c)}</span>`).join(' ')}</p>
      ${top ? `<ul class="themes">${top}</ul>` : ''}
      <p class="note">${esc(b.note)}${missing.length && live ? ` Not yet covered: ${esc(missing.join(', '))}.` : ''}</p>
      <footer>${watchLinks}${live ? `<button type="button" class="link" data-open-basin="${esc(b.id)}">Open records →</button>` : ''}</footer>
    </article>`;
  }).join('');
  $('#basin-grid').addEventListener('click', e => { const b = e.target.closest('[data-open-basin]'); if (b) openFilter({basin: b.dataset.openBasin}); });
}

function planUrl(w) { return `https://github.com/sadiulchyon/global-sand-watch/blob/main/${w.collectionPlan}`; }

/* ---------- compare ---------- */
function renderCompare() {
  const live = state.registry.watches.filter(w => state.records.some(r => r.watch === w.id));
  const themes = themeShares(state.records).map(([t]) => t);
  const perWatch = Object.fromEntries(live.map(w => {
    const recs = state.records.filter(r => r.watch === w.id);
    const m = new Map(themeShares(recs));
    return [w.id, {n: recs.length, m}];
  }));
  $('#compare-themes').innerHTML = `<div class="cmp-legend">${live.map(w => `<span><i style="background:${WATCH_COLORS[w.id]}"></i>${esc(w.name)} (${fmt(perWatch[w.id].n)})</span>`).join('')}</div>` +
    themes.map(t => `<div class="cmp-row"><button type="button" class="cmp-label link" data-theme="${esc(t)}">${esc(t)}</button><div class="cmp-bars">${live.map(w => {
      const v = perWatch[w.id].m.get(t) || 0;
      const pct = v / perWatch[w.id].n * 100;
      return `<div class="bar" title="${esc(w.name)}: ${fmt(v)} of ${fmt(perWatch[w.id].n)} records"><i style="width:${pct.toFixed(1)}%;background:${WATCH_COLORS[w.id]}"></i><span>${pct.toFixed(0)}%</span></div>`;
    }).join('')}</div></div>`).join('');
  $('#compare-themes').addEventListener('click', e => { const b = e.target.closest('[data-theme]'); if (b) openFilter({theme: b.dataset.theme}); });

  const years = new Map();
  for (const r of state.records) {
    const y = r.date?.slice(0, 4);
    if (!y || y < '2005') continue;
    if (!years.has(y)) years.set(y, {});
    years.get(y)[r.watch] = (years.get(y)[r.watch] || 0) + 1;
  }
  const ys = [...years.keys()].sort();
  const max = Math.max(...ys.map(y => Object.values(years.get(y)).reduce((a, b) => a + b, 0)));
  $('#timeline').innerHTML = ys.map(y => {
    const parts = years.get(y);
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return `<button type="button" class="yr" data-year="${y}" title="${y}: ${fmt(total)} records">
      <span class="stack" style="height:${(total / max * 100).toFixed(1)}%">${live.map(w => parts[w.id] ? `<i style="flex:${parts[w.id]};background:${WATCH_COLORS[w.id]}"></i>` : '').join('')}</span>
      <span class="yl">${y.slice(2)}</span></button>`;
  }).join('');
  $('#timeline').addEventListener('click', e => { const b = e.target.closest('[data-year]'); if (b) openFilter({from: b.dataset.year, to: b.dataset.year}); });
}

/* ---------- archive ---------- */
const FACETS = {
  basin: {all: 'All basins', values: r => r.basins, label: v => state.basinById[v]?.name || v},
  country: {all: 'All countries', values: r => r.countries},
  watch: {all: 'All watches', values: r => [r.watch], label: v => state.watchById[v]?.name || v},
  theme: {all: 'All themes', values: r => r.themes},
  category: {all: 'All types', values: r => [r.category]},
  language: {all: 'All languages', values: r => [r.language]},
  river: {all: 'All rivers', values: r => r.rivers, limit: 150},
  review: {all: 'Any review status', values: r => [r.review]}
};

function renderFilters() {
  const form = $('#filters');
  const f = state.filters;
  for (const [key, cfg] of Object.entries(FACETS)) {
    const sel = form.elements[key];
    let opts = facetCounts(state.records, f, key, cfg.values);
    if (cfg.limit) opts = opts.slice(0, cfg.limit);
    if (f[key] && !opts.some(([v]) => v === f[key])) opts.unshift([f[key], 0]);
    sel.innerHTML = `<option value="">${cfg.all}</option>` + opts.map(([v, n]) => `<option value="${esc(v)}">${esc(cfg.label ? cfg.label(v) : v)} (${fmt(n)})</option>`).join('');
    sel.value = f[key] || '';
  }
  const years = [...new Set(state.records.map(r => r.date?.slice(0, 4)).filter(Boolean))].sort();
  for (const key of ['from', 'to']) {
    const sel = form.elements[key];
    sel.innerHTML = `<option value="">Any</option>` + years.map(y => `<option>${y}</option>`).join('');
    sel.value = f[key] || '';
  }
  form.elements.q.value = f.q || '';
}

function current() { return sortRecords(filterRecords(state.records, state.filters), state.sort); }

function renderResults() {
  const list = current();
  const active = FILTER_KEYS.filter(k => state.filters[k]).length;
  $('#result-count').textContent = `${fmt(list.length)} of ${fmt(state.records.length)} records${active ? ' match the filters' : ''}.`;
  $('#results').innerHTML = list.slice(0, state.shown).map(r => {
    const w = state.watchById[r.watch];
    const showOriginal = r.titleEn && r.titleEn !== r.title;
    const where = [r.publisher, r.rivers.slice(0, 3).join(', '), (r.counties || []).join(', '), r.countries.join(', ')].filter(Boolean).join(' · ');
    return `<li><button type="button" class="rec" data-gid="${esc(r.gid)}">
      <span class="meta"><i class="dot" style="background:${WATCH_COLORS[r.watch]}"></i>${esc(w?.name || r.watch)} · ${esc(r.category)} · ${esc(dateLabel(r))}</span>
      <span class="t">${esc(r.titleEn || r.title)}</span>
      ${showOriginal ? `<span class="orig" lang="">${esc(r.title)}</span>` : ''}
      <span class="where">${esc(where)}</span>
      <span class="s">${esc(r.summary.length > 240 ? r.summary.slice(0, 240).replace(/\s\S*$/, '') + '…' : r.summary)}</span>
      ${r.review !== 'Accepted by member watch' ? `<span class="flag">${esc(r.review)}</span>` : ''}
    </button></li>`;
  }).join('') || '<li class="empty">No records match. Try clearing a filter.</li>';
  $('#more').hidden = list.length <= state.shown;
  $('#more').textContent = `Show more (${fmt(list.length - state.shown)} remaining)`;
}

function update({keepPage = false} = {}) {
  if (!keepPage) state.shown = PAGE;
  renderFilters();
  renderResults();
  const params = new URLSearchParams();
  for (const k of FILTER_KEYS) if (state.filters[k]) params.set(k, state.filters[k]);
  if (state.sort !== 'newest') params.set('sort', state.sort);
  const qs = params.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? '?' + qs : ''}${location.hash}`);
}

function openFilter(f) {
  state.filters = {...f};
  update();
  $('#archive').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}

function detail(gid) {
  const r = state.records.find(x => x.gid === gid);
  if (!r) return;
  const w = state.watchById[r.watch];
  const url = safeUrl(r.url);
  const rows = [
    ['Collected by', w?.hosted ? `Global Sand Watch (${esc(w.name)}) · record ${esc(r.sourceId)}` : w?.siteUrl ? `<a href="${esc(w.siteUrl)}">${esc(w.name)}</a> · record ${esc(r.sourceId)}` : esc(r.watch)],
    ['Counties', esc((r.counties || []).join(', '))],
    ['Publisher', esc([r.publisher, r.authors].filter(Boolean).join(' — '))],
    ['Date', `${esc(dateLabel(r))}${r.dateKind ? ` (${esc(r.dateKind)})` : ''}`],
    ['Date evidence', esc(r.dateEvidence)],
    ['Basin', esc(r.basins.map(b => state.basinById[b]?.name || b).join(', '))],
    ['Countries', esc(r.countries.join(', '))],
    ['Location', esc(r.location)],
    ['Rivers', esc(r.rivers.join(', '))],
    ['Materials', esc(r.materials.join(', '))],
    ['Language', esc(r.language)],
    ['Themes (derived)', esc(r.themes.join(', '))],
    ['Member topics', esc(r.topics.join(', '))],
    ['Review', esc([r.review, r.reviewDetail].filter(Boolean).join(' — '))],
    ['DOI', r.doi ? `<a href="https://doi.org/${esc(encodeURI(r.doi))}">${esc(r.doi)}</a>` : '']
  ].filter(([, v]) => v);
  $('#d-body').innerHTML = `<p class="meta"><i class="dot" style="background:${WATCH_COLORS[r.watch]}"></i>${esc(r.category)} · ${esc(r.gid)}</p>
    <h2 id="d-title">${esc(r.titleEn || r.title)}</h2>
    ${r.titleEn && r.titleEn !== r.title ? `<p class="orig">${esc(r.title)}</p>` : ''}
    <p class="summary">${esc(r.summary)}</p>
    ${r.hasLocalSummary ? `<p class="hint">A ${esc(r.language === 'English' ? 'Bangla' : r.language)} summary is available on the member watch.</p>` : ''}
    ${r.limitations ? `<div class="limits"><strong>Limitations</strong><p>${esc(r.limitations)}</p></div>` : ''}
    <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${url ? `<p><a class="btn" href="${esc(url)}" rel="noopener noreferrer" target="_blank">Read the original source ↗</a></p>` : '<p class="hint">No original link recorded.</p>'}`;
  $('#detail').showModal();
}

function exportCsv() {
  const rows = [CSV_COLUMNS.map(([h]) => h), ...current().map(r => CSV_COLUMNS.map(([, fn]) => fn(r)))];
  const blob = new Blob([csv(rows)], {type: 'text/csv;charset=utf-8'});
  const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: `global-sand-watch-${state.archive.updated}.csv`});
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function bind() {
  const form = $('#filters');
  let t;
  form.addEventListener('input', e => {
    const el = e.target;
    if (!el.name) return;
    clearTimeout(t);
    t = setTimeout(() => { state.filters[el.name] = el.value.trim(); update(); }, el.name === 'q' ? 220 : 0);
  });
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('reset', e => { e.preventDefault(); state.filters = {}; update(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; update(); });
  $('#more').addEventListener('click', () => { state.shown += PAGE; renderResults(); });
  $('#results').addEventListener('click', e => { const b = e.target.closest('[data-gid]'); if (b) detail(b.dataset.gid); });
  $('#export').addEventListener('click', exportCsv);
  $('#hero-form').addEventListener('submit', e => { e.preventDefault(); openFilter({q: $('#hero-q').value.trim()}); });
  $('#detail').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  const members = state.registry.watches.filter(w => !w.hosted), hosted = state.registry.watches.filter(w => w.hosted);
  $('#member-links').innerHTML = 'Member watches: ' + members.map(w => `<a href="${esc(w.siteUrl)}">${esc(w.name)}</a> (<a href="${esc(w.repositoryUrl)}">repository</a>)`).join(' · ') +
    '<br>Hosted here: ' + hosted.map(w => `${esc(w.name)} (<a href="${esc(planUrl(w))}">collection plan</a>, <a href="https://github.com/sadiulchyon/global-sand-watch/blob/main/${esc(w.archivePath)}">data</a>)`).join(' · ');
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  for (const k of FILTER_KEYS) if (params.get(k)) state.filters[k] = params.get(k);
  if (['oldest', 'title'].includes(params.get('sort'))) state.sort = params.get('sort');
  $('#sort').value = state.sort;
}

try {
  await load();
  readUrl();
  renderStats();
  renderMap();
  renderBasins();
  renderCompare();
  bind();
  update();
} catch (error) {
  console.error(error);
  $('#load-error').hidden = false;
  $('#result-count').textContent = 'The archive could not be loaded.';
}
