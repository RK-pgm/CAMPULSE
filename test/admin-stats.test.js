'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminStats } = require('../lib/admin-stats');

test('builds school-scoped analytics and excludes other schools', () => {
  const now = Date.parse('2026-11-01T05:00:00.000Z');
  const result = buildAdminStats({
    items: [
      { id: 'a', schoolId: 'ts', schoolName: 'ทุ่งสง', type: 'lost', status: 'resolved', category: 'กระเป๋า', location: 'โรงอาหาร', createdAt: '2026-10-31T04:00:00.000Z', returnedAt: '2026-10-31T06:00:00.000Z' },
      { id: 'b', schoolId: 'ts', schoolName: 'ทุ่งสง', type: 'found', status: 'open', category: 'กระเป๋า', location: 'โรงอาหาร', createdAt: '2026-10-30T04:00:00.000Z' },
      { id: 'c', schoolId: 'other', type: 'lost', status: 'open', category: 'มือถือ', createdAt: '2026-10-31T04:00:00.000Z' },
    ],
    claims: [{ itemId: 'b', status: 'pending', createdAt: '2026-10-31T04:00:00.000Z' }],
  }, '30', 'ts', now);

  assert.equal(result.totals.total, 2);
  assert.equal(result.totals.lost, 1);
  assert.equal(result.totals.found, 1);
  assert.equal(result.totals.resolved, 1);
  assert.equal(result.totals.closeRate, 50);
  assert.equal(result.closeTime.medianHours, 2);
  assert.equal(result.claims.pending, 1);
  assert.equal(result.categories[0].name, 'กระเป๋า');
  assert.equal(result.places[0].name, 'โรงอาหาร');
  assert.deepEqual(result.schools, [{ id: 'ts', name: 'ทุ่งสง' }]);
});

test('returns empty and null-safe values when no matching announcements exist', () => {
  const result = buildAdminStats({ items: [], claims: [] }, '7', 'ts', Date.parse('2026-11-01T05:00:00.000Z'));
  assert.equal(result.totals.total, 0);
  assert.equal(result.totals.closeRate, null);
  assert.equal(result.closeTime.medianHours, null);
  assert.equal(result.backlog.stale, 0);
  assert.deepEqual(result.trend, []);
});
