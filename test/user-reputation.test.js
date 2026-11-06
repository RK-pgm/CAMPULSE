'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeUserReputation } = require('../lib/user-reputation');

test('returns neutral badge for user without reviews or points', () => {
  const rep = computeUserReputation('u1', { userReviews: [], pointLedger: [] });
  assert.equal(rep.ratingAverage, null);
  assert.equal(rep.ratingCount, 0);
  assert.equal(rep.scamReportsCount, 0);
  assert.equal(rep.badge.kind, 'neutral');
  assert.match(rep.badge.label, /สมาชิกใหม่/);
});

test('computes average rating and positive badge for good member', () => {
  const store = {
    userReviews: [
      {
        targetUserId: 'u2',
        rating: 5,
        tags: ['🌟 คนดีมีน้ำใจ', '✅ ส่งคืนของจริง'],
        comment: 'ขอบคุณมากครับ ส่งคืนตรงเวลาเลย',
      },
      {
        targetUserId: 'u2',
        rating: 5,
        tags: ['⚡ ตอบแชทไว', '🤝 ซื่อสัตย์ไว้ใจได้'],
        comment: 'พูดจาสุภาพมากครับ',
      },
    ],
    pointLedger: [{ userId: 'u2', points: 10 }],
  };
  const rep = computeUserReputation('u2', store);
  assert.equal(rep.ratingAverage, 5.0);
  assert.equal(rep.ratingCount, 2);
  assert.equal(rep.positiveTagsCount, 4);
  assert.equal(rep.scamReportsCount, 0);
  assert.equal(rep.badge.kind, 'verified');
  assert.match(rep.badge.label, /สมาชิกคนดีมีน้ำใจ/);
});

test('triggers scam warning badge when scam tags or low stars are reported', () => {
  const store = {
    userReviews: [
      {
        targetUserId: 'u3',
        rating: 1,
        tags: ['⚠️ โกง / มิจฉาชีพ', '🚫 ขอเงินโอนล่วงหน้า'],
        comment: 'หลอกให้โอนเงินค่าส่งแล้วหายตัว',
      },
      {
        targetUserId: 'u3',
        rating: 2,
        tags: ['❌ ไม่ส่งของจริง'],
        comment: 'ไม่นำของมาส่งตามที่นัดไว้',
      },
    ],
    pointLedger: [],
  };
  const rep = computeUserReputation('u3', store);
  assert.equal(rep.ratingAverage, 1.5);
  assert.equal(rep.ratingCount, 2);
  assert.ok(rep.scamReportsCount >= 2);
  assert.equal(rep.badge.kind, 'danger');
  assert.match(rep.badge.label, /ควรระวัง/);
});

test('ranks topTags properly by count', () => {
  const store = {
    userReviews: [
      { targetUserId: 'u4', rating: 5, tags: ['🌟 คนดีมีน้ำใจ', '⚡ ตอบแชทไว'] },
      { targetUserId: 'u4', rating: 4, tags: ['🌟 คนดีมีน้ำใจ', '📍 ตรงต่อเวลา'] },
      { targetUserId: 'u4', rating: 5, tags: ['🌟 คนดีมีน้ำใจ'] },
    ],
  };
  const rep = computeUserReputation('u4', store);
  assert.equal(rep.topTags[0].tag, '🌟 คนดีมีน้ำใจ');
  assert.equal(rep.topTags[0].count, 3);
});

