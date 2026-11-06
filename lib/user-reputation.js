'use strict';

function computeUserReputation(targetUserId, store) {
  const reviews = (store?.userReviews || []).filter((r) => r.targetUserId === targetUserId);
  const returnedPoints = (store?.pointLedger || [])
    .filter((entry) => entry.userId === targetUserId && entry.points > 0)
    .reduce((sum, e) => sum + e.points, 0);

  const ratingCount = reviews.length;
  const ratingSum = reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
  const ratingAverage = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;

  const positiveTagSet = new Set(['🌟 คนดีมีน้ำใจ', '✅ ส่งคืนของจริง', '⚡ ตอบแชทไว', '🤝 ซื่อสัตย์ไว้ใจได้', '📍 ตรงต่อเวลา']);
  const warningTagSet = new Set(['⚠️ โกง / มิจฉาชีพ', '❌ ไม่ส่งของจริง', '🚩 พฤติกรรมน่าสงสัย', '🚫 ขอเงินโอนล่วงหน้า']);

  let positiveTagsCount = 0;
  let scamReportsCount = 0;
  const tagCounts = {};

  for (const review of reviews) {
    if (review.rating <= 2) scamReportsCount++;
    if (Array.isArray(review.tags)) {
      for (const tag of review.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        if (warningTagSet.has(tag)) scamReportsCount++;
        if (positiveTagSet.has(tag)) positiveTagsCount++;
      }
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));

  let badge;
  if (scamReportsCount >= 2 || (ratingAverage !== null && ratingAverage < 2.5 && ratingCount >= 2)) {
    badge = {
      label: '⚠️ ควรระวัง / มีรายงานพฤติกรรมไม่โปร่งใส',
      kind: 'danger',
      icon: '🚨',
      description: 'มีสมาชิกแจ้งเตือนเกี่ยวกับพฤติกรรมของบัญชีนี้ โปรดระมัดระวังในการติดต่อและส่งมอบของ',
    };
  } else if ((ratingAverage !== null && ratingAverage >= 4.5 && ratingCount >= 2) || returnedPoints >= 20) {
    badge = {
      label: '🌟 สมาชิกคนดีมีน้ำใจ (ประวัติดีเยี่ยม)',
      kind: 'verified',
      icon: '🏅',
      description: 'ได้รับดาวและการชื่นชมจากเพื่อนร่วมสถาบัน มีประวัติการส่งคืนของจริงและตอบแชทสุภาพ',
    };
  } else if (ratingCount > 0 && ratingAverage !== null && ratingAverage >= 3.5) {
    badge = {
      label: '👍 สมาชิกทั่วไป (คะแนนดี)',
      kind: 'good',
      icon: '✨',
      description: 'ได้รับคะแนนและรีวิวในเกณฑ์ดี ไร้รายงานการทุจริต',
    };
  } else {
    badge = {
      label: '🌱 สมาชิกใหม่ (ยังไม่มีรีวิว)',
      kind: 'neutral',
      icon: '🔰',
      description: 'ยังไม่มีประวัติการรีวิวจากผู้ใช้คนอื่น',
    };
  }

  return {
    ratingAverage,
    ratingCount,
    positiveTagsCount,
    scamReportsCount,
    returnedPoints,
    badge,
    topTags,
  };
}

module.exports = {
  computeUserReputation,
};

