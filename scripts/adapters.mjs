// Adapters convert each member watch's published archive into the shared global record shape.
// They only reshape and label fields. Summaries, dates, figures and editorial decisions are
// copied from the member archive unchanged; nothing is re-written or re-verified here.

export const CATEGORIES = ['News', 'Research', 'Official', 'Opinion', 'Project', 'Context'];

const BD_CATEGORY = {
  News: 'News', Research: 'Research', Editorial: 'Opinion', Context: 'Context',
  Lease: 'Official', Law: 'Official', Rules: 'Official', Project: 'Project'
};

// Rivers of the Chittagong hills and coast that reach the Bay of Bengal outside the GBM system.
const SE_BD_RIVERS = /\b(karnaphuli|karnafuli|halda|sangu|matamuhuri|bakkhali|naf|maheshkhali|kutubdia)\b/i;
const NOT_A_RIVER = /^(no (specific )?river|national|multiple rivers|not (stated|named)|none|n\/a|unspecified)/i;

export function splitList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value ?? '').split(/;|\n/).map(v => v.trim()).filter(Boolean);
}

// "Padma River" and "Padma" become one facet value; local-script names are kept as written.
export function riverName(value) {
  const v = String(value).replace(/\s+/g, ' ').trim();
  if (!v || NOT_A_RIVER.test(v)) return '';
  const base = v.replace(/\s+(river|rivers|nadi|nodi)$/i, '').replace(/^(sông|river)\s+/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Spelling and script variants of the same river, merged for facets only.
const RIVER_ALIASES = {
  'tiền': 'Tien', 'tien river': 'Tien', 'hậu': 'Hau / Bassac', 'hau': 'Hau / Bassac', 'bassac': 'Hau / Bassac',
  'hau river': 'Hau / Bassac', 'แม่น้ำโขง': 'Mekong', 'ទន្លេមេគង្គ': 'Mekong', 'mekong river': 'Mekong',
  'ទន្លេសាប': 'Tonle Sap', 'vàm nao': 'Vam Nao', 'lancang-mekong': 'Lancang', 'karnafuli': 'Karnaphuli',
  'jamuna (brahmaputra)': 'Jamuna', 'not named': '', 'unnamed': '', 'unspecified': ''
};
export function riverFacet(value) {
  const name = riverName(value);
  const alias = RIVER_ALIASES[name.toLowerCase()];
  return alias === undefined ? name : alias;
}

// Derived cross-basin themes. Member topics stay as written; themes are a coarse, rule-based
// index over each record's own topics and English title so basins can be compared.
export const THEMES = [
  ['Illegal extraction', /illegal|unauthori[sz]ed|unlicen[sc]ed|looting|theft|smuggl|lut\b/i],
  ['Enforcement & penalties', /enforce|mobile court|raid|arrest|seiz|fine[sd]?\b|penalt|prosecut|crackdown|jail|confiscat/i],
  ['Riverbank & coastal erosion', /erosion|bank collapse|riverbank|landslide|sạt lở|subsid/i],
  ['Leasing & licensing', /lease|licen[sc]|permit|auction|mahal|quota|concession|tender/i],
  ['Construction & infrastructure demand', /expressway|highway|construction|infrastructure|embankment|reclamation|concrete|supply chain|demand|price|shortage/i],
  ['Sediment & riverbed change', /sediment|riverbed|bathymetr|incision|deficit|delta (sinking|shrink)|morpholog|hydrolog/i],
  ['Livelihoods & community conflict', /livelihood|farmer|fisher|protest|complain|residents|conflict|clash|community|displac/i],
  ['Violence & intimidation', /\b(attack|assault|murder|stabb|gunfight|gunshot|shot dead|kidnap|abduct|beaten|injur|shoot|armed|clash|killed|violence|intimidat|death threat|hacked to death|journalist)/i],
  ['Policy, law & courts', /governance|oversight|management plan|hotline|policy|law\b|legislat|regulat|court|writ|ban\b|moratorium|decree|rules?\b|act\b|ministry|parliament/i],
  ['Marine & coastal sand', /sea sand|marine sand|offshore|coastal sand|beach sand|dredg(ing|e) (at|in) sea/i],
  ['Stone, gravel & hill cutting', /stone|gravel|quarr|boulder|hill cutting|tila/i],
  ['Ecology & biodiversity', /ecolog|biodivers|dolphin|fish (stock|breed)|habitat|wetland|mangrove|spawning/i]
];
export function themesFor(...texts) {
  const corpus = texts.flat().filter(Boolean).join(' | ');
  return THEMES.filter(([, re]) => re.test(corpus)).map(([name]) => name);
}

export function uniq(values) {
  const seen = new Map();
  for (const v of values) {
    const key = String(v).toLowerCase();
    if (v && !seen.has(key)) seen.set(key, v);
  }
  return [...seen.values()];
}

// Topic facets are case-folded so "Riverbank erosion" and "riverbank erosion" merge.
export function topicName(value) {
  const v = String(value).replace(/\s+/g, ' ').trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
}

function isoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? value : null;
}

function bangladesh(record, watch) {
  const riversRaw = splitList(record.river);
  const rivers = uniq(riversRaw.map(riverFacet).filter(Boolean));
  const basin = rivers.some(r => SE_BD_RIVERS.test(r)) ? 'se-bangladesh-hill-rivers' : watch.defaultBasin;
  const limitations = [record.flag, record.notes].filter(Boolean).join(' ');
  return {
    title: record.title,
    titleEn: record.titleEn || (record.language === 'English' ? record.title : ''),
    publisher: record.source || '',
    authors: '',
    category: BD_CATEGORY[record.type] || 'Context',
    categoryOriginal: record.type,
    date: isoDate(record.date),
    dateKind: record.dateKind || '',
    dateEvidence: record.evidence || '',
    language: record.language || '',
    countries: ['Bangladesh'],
    basins: [basin],
    location: record.district || '',
    rivers,
    materials: uniq(splitList(record.material).map(topicName)),
    topics: uniq(splitList(record.topics).map(topicName)),
    summary: record.en || '',
    hasLocalSummary: Boolean(record.bn),
    limitations,
    url: record.url || '',
    doi: record.documentId && /^10\./.test(record.documentId) ? record.documentId : '',
    review: record.decision === 'Accept' ? 'Accepted by member watch' : (record.decision || 'Pending'),
    reviewDetail: record.auto ? `Automated collection (${record.collector || 'collector'}) with second-pass editorial review` : 'Owner-accepted record',
    collectedAt: record.collectedAt ? String(record.collectedAt).slice(0, 10) : ''
  };
}

function mekong(record, watch) {
  const reviewPending = /pending|awaiting/i.test(record.editorialStatus || '');
  return {
    title: record.originalTitle || record.title,
    titleEn: record.title,
    publisher: record.publisher || '',
    authors: record.authors || '',
    category: CATEGORIES.includes(record.category) ? record.category : 'Context',
    categoryOriginal: record.category,
    date: isoDate(record.date),
    dateKind: record.dateKind || '',
    dateEvidence: record.dateEvidence || '',
    language: record.language || '',
    countries: splitList(record.countries),
    basins: [watch.defaultBasin],
    location: record.location || '',
    rivers: uniq(splitList(record.rivers).map(riverFacet).filter(Boolean)),
    materials: ['Sand'],
    topics: uniq(splitList(record.topics).map(topicName)),
    summary: record.summary || '',
    hasLocalSummary: false,
    limitations: record.limitations || '',
    url: record.url || '',
    doi: record.doi || '',
    review: reviewPending ? 'Member review pending' : 'Accepted by member watch',
    reviewDetail: record.editorialStatus || '',
    collectedAt: record.retrievedAt || ''
  };
}

// For new watches built directly on the global schema (Kenya, Rwanda): records already match.
function globalV1(record, watch) {
  return {
    ...record,
    countries: splitList(record.countries),
    basins: splitList(record.basins).length ? splitList(record.basins) : [watch.defaultBasin],
    rivers: uniq(splitList(record.rivers).map(riverFacet).filter(Boolean)),
    materials: uniq(splitList(record.materials).map(topicName)),
    topics: uniq(splitList(record.topics).map(topicName)),
    date: isoDate(record.date)
  };
}

const ADAPTERS = {'bangladesh-v1': bangladesh, 'mekong-v1': mekong, 'global-v1': globalV1};

export function adapt(archive, watch) {
  const fn = ADAPTERS[watch.adapter];
  if (!fn) throw new Error(`No adapter "${watch.adapter}" for watch ${watch.id}`);
  if (!archive || !Array.isArray(archive.records)) throw new Error(`${watch.id}: archive has no records array`);
  const reviews = archive.reviews || {};
  const out = [];
  let excluded = 0;
  for (const raw of archive.records) {
    const record = {...raw, decision: reviews[raw.id]?.decision ?? raw.decision};
    if (watch.includeDecisions && !watch.includeDecisions.includes(record.decision)) { excluded++; continue; }
    const adapted = fn(record, watch);
    adapted.themes = themesFor(adapted.topics, adapted.materials, adapted.titleEn || adapted.title);
    out.push({gid: `${watch.id}:${raw.id}`, watch: watch.id, sourceId: raw.id, ...adapted});
  }
  return {records: out, excluded};
}
