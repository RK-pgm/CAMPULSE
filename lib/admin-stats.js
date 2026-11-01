'use strict';

const DAY = 86400000;
const STALE_DAYS = 7;
function startOfDay(ms) {
  const date = new Date(ms + 7 * 3600000);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() - 7 * 3600000;
}
function closedAt(item) {
  if (item.status !== 'resolved') return null;
  const event = (item.timeline || []).slice().reverse().find((entry) => ['returned', 'closed'].includes(entry.type));
  const time = Date.parse(item.returnedAt || event?.at || item.updatedAt || '');
  return Number.isFinite(time) ? time : null;
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}
function buildAdminStats(store, rangeValue = '30', schoolValue = 'all', now = Date.now()) {
  const range = ['7', '30', '90', 'all'].includes(String(rangeValue)) ? String(rangeValue) : '30';
  const schoolId = String(schoolValue || 'all');
  const items = (store.items || []).filter((item) => schoolId === 'all' || item.schoolId === schoolId);
  const periodStart = range === 'all' ? -Infinity : startOfDay(now) - (Number(range) - 1) * DAY;
  const cohort = items.filter((item) => Date.parse(item.createdAt || '') >= periodStart);
  const resolved = cohort.filter((item) => item.status === 'resolved');
  const durations = resolved.map((item) => (closedAt(item) - Date.parse(item.createdAt || '')) / 3600000).filter((v) => Number.isFinite(v) && v >= 0);
  const stale = items.filter((item) => ['open', 'reviewing'].includes(item.status) && now - Date.parse(item.createdAt || '') > STALE_DAYS * DAY).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const counts = { lost: 0, found: 0, resolved: 0, expired: 0, open: 0, reviewing: 0 };
  const categoryMap = new Map();
  const placeMap = new Map();
  const trendMap = new Map();
  for (const item of cohort) {
    if (item.type === 'lost' || item.type === 'found') counts[item.type]++;
    if (item.status in counts) counts[item.status]++;
    const key = String(item.category || 'Other');
    const row = categoryMap.get(key) || { name: key, lost: 0, found: 0 };
    if (item.type === 'lost' || item.type === 'found') row[item.type]++;
    categoryMap.set(key, row);
    const placeKey = item.placeId ? `${item.schoolId}:${item.placeId}` : `legacy:${item.location || 'ไม่ระบุ'}`;
    const place = placeMap.get(placeKey) || { name: item.placeName || item.location || 'ไม่ระบุ', lost: 0, found: 0 };
    if (item.type === 'lost' || item.type === 'found') place[item.type]++;
    placeMap.set(placeKey, place);
    const date = new Date(item.createdAt || NaN);
    if (Number.isFinite(date.getTime())) {
      const label = new Date(startOfDay(date.getTime()) + 7 * 3600000).toISOString().slice(0, 10);
      const point = trendMap.get(label) || { date: label, lost: 0, found: 0, closed: 0 };
      if (item.type === 'lost' || item.type === 'found') point[item.type]++;
      trendMap.set(label, point);
    }
  }
  const allIds = new Set(items.map((item) => item.id));
  const claims = (store.claims || []).filter((claim) => allIds.has(claim.itemId));
  const schools = new Map();
  for (const item of items) if (item.schoolId) schools.set(item.schoolId, item.schoolName || item.schoolId);
  return {
    range, schoolId, generatedAt: new Date(now).toISOString(), staleDays: STALE_DAYS,
    schools: [...schools].map(([id, name]) => ({ id, name })),
    totals: { ...counts, total: cohort.length, qrConfirmed: cohort.filter((item) => item.returnedAt).length, closeRate: cohort.length ? Math.round(resolved.length / cohort.length * 1000) / 10 : null },
    closeTime: { n: durations.length, medianHours: median(durations) },
    backlog: { open: items.filter((item) => ['open', 'reviewing'].includes(item.status)).length, stale: stale.length, oldest: stale.slice(0, 5).map((item) => ({ id: item.id, type: item.type, itemName: item.itemName, placeName: item.placeName || item.location || '', ageDays: Math.floor((now - Date.parse(item.createdAt)) / DAY) })) },
    claims: { pending: claims.filter((claim) => claim.status === 'pending').length, inPeriod: claims.filter((claim) => Date.parse(claim.createdAt || '') >= periodStart).length },
    categories: [...categoryMap.values()].sort((a, b) => b.lost + b.found - a.lost - a.found),
    places: [...placeMap.values()].sort((a, b) => b.lost + b.found - a.lost - a.found).slice(0, 12),
    trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
module.exports = { buildAdminStats };
