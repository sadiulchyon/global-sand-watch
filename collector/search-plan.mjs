// Rotate extra coverage of less-reported areas without multiplying the number of API searches.
export function focusedSearch(list, dayIndex) {
  if (!list?.length) return null;
  return list[((dayIndex % list.length) + list.length) % list.length];
}
// Draw one result from each query before considering the next result from any query.
export function interleave(groups) {
  const result = [];
  const maximum = Math.max(0, ...groups.map(group => group.length));
  for (let index = 0; index < maximum; index++) {
    for (const group of groups) if (index < group.length) result.push(group[index]);
  }
  return result;
}
export function canonicalUrl(value) {
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol)) return '';
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    return u.href.replace(/\/$/, '');
  } catch { return ''; }
}
export function archiveSourceUrls(records) {
  return new Set(records.map(record => canonicalUrl(record.url)).filter(Boolean));
}
