'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const handler = require('../server');

function makeRequest(server, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: {
          'Origin': `http://127.0.0.1:${addr.port}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

test('Chat, Friends, and Review E2E flow', async () => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Register User A
    const resA = await makeRequest(server, 'POST', '/api/register', {}, {
      name: 'สมชาย เรียนดี',
      studentId: '112233',
      password: 'Password123!',
      schoolId: 'thung-song',
      province: 'นครศรีธรรมราช',
      schoolName: 'โรงเรียนทุ่งสง',
      grade: 'ม.5/1',
      avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
    // Can be 201 or 409 if already exists
    assert.ok(resA.status === 201 || resA.status === 409, `Register A status: ${resA.status}`);
    
    // Login User A
    const loginA = await makeRequest(server, 'POST', '/api/login', {}, {
      studentId: '112233',
      password: 'Password123!',
    });
    assert.equal(loginA.status, 200);
    const cookieA = loginA.headers['set-cookie']?.[0]?.split(';')[0];
    const userA = loginA.body.user;
    assert.equal(userA.name, 'สมชาย เรียนดี');

    // 2. Register User B
    const resB = await makeRequest(server, 'POST', '/api/register', {}, {
      name: 'สมหญิง มีน้ำใจ',
      studentId: '445566',
      password: 'Password123!',
      schoolId: 'thung-song',
      province: 'นครศรีธรรมราช',
      schoolName: 'โรงเรียนทุ่งสง',
      grade: 'ม.5/2',
    });
    assert.ok(resB.status === 201 || resB.status === 409);

    // Login User B
    const loginB = await makeRequest(server, 'POST', '/api/login', {}, {
      studentId: '445566',
      password: 'Password123!',
    });
    assert.equal(loginB.status, 200);
    const cookieB = loginB.headers['set-cookie']?.[0]?.split(';')[0];
    const userB = loginB.body.user;
    assert.equal(userB.name, 'สมหญิง มีน้ำใจ');

    // 3. Send Message from User A to User B
    const sendMsg = await makeRequest(server, 'POST', '/api/messages', { 'Cookie': cookieA }, {
      toId: userB.id,
      message: 'สวัสดีครับ ของที่แจ้งไว้ยังอยู่ไหมครับ?',
    });
    assert.equal(sendMsg.status, 201);

    // 4. User B gets Thread with User A
    const getThread = await makeRequest(server, 'GET', `/api/messages/thread?userId=${userA.id}`, { 'Cookie': cookieB });
    assert.equal(getThread.status, 200);
    assert.equal(getThread.body.targetUser.name, 'สมชาย เรียนดี');
    assert.ok(getThread.body.messages.some((m) => m.message.includes('ของที่แจ้งไว้ยังอยู่ไหมครับ')));

    // 5. User B replies to User A
    const replyMsg = await makeRequest(server, 'POST', '/api/messages', { 'Cookie': cookieB }, {
      toId: userA.id,
      message: 'ยังอยู่ครับ มารับได้ที่โรงอาหารเลยครับ',
    });
    assert.equal(replyMsg.status, 201);

    // 6. User A adds User B as friend
    const addFriend = await makeRequest(server, 'POST', '/api/friends/add', { 'Cookie': cookieA }, {
      friendId: userB.id,
    });
    assert.equal(addFriend.status, 200);
    assert.equal(addFriend.body.isFriend, true);

    // Check User A's friends list
    const friendsList = await makeRequest(server, 'GET', '/api/friends', { 'Cookie': cookieA });
    assert.equal(friendsList.status, 200);
    assert.ok(friendsList.body.friends.some((f) => f.id === userB.id));

    // 7. User A reviews User B (5 stars + Grab style tags)
    const reviewRes = await makeRequest(server, 'POST', '/api/user-reviews', { 'Cookie': cookieA }, {
      targetUserId: userB.id,
      rating: 5,
      tags: ['🌟 คนดีมีน้ำใจ', '✅ ส่งคืนของจริง', '⚡ ตอบแชทไว'],
      comment: 'ส่งคืนของรวดเร็วมากครับ นิสัยดีมาก',
    });
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.body.ok, true);

    // 8. Fetch User B's public profile
    const profileRes = await makeRequest(server, 'GET', `/api/users/profile?userId=${userB.id}`, { 'Cookie': cookieA });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.user.name, 'สมหญิง มีน้ำใจ');
    assert.equal(profileRes.body.isFriend, true);
    assert.equal(profileRes.body.reputation.ratingAverage, 5.0);
    assert.ok(profileRes.body.reviews.length >= 1);

    // 9. Conversations endpoint
    const convos = await makeRequest(server, 'GET', '/api/messages/conversations', { 'Cookie': cookieA });
    assert.equal(convos.status, 200);
    assert.ok(convos.body.conversations.some((c) => c.partner.id === userB.id));

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

