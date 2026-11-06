'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const handler = require('../server');

function makeRequest(server, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const encodedPath = encodeURI(path);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: encodedPath,
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

test('Real-time chat SSE stream and Friends discovery test', async () => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();

  try {
    // 1. Register User 1
    await makeRequest(server, 'POST', '/api/register', {}, {
      name: 'กิตติพงษ์ ใจดี',
      studentId: '556677',
      password: 'Password123!',
      schoolId: 'thung-song',
      schoolName: 'โรงเรียนทุ่งสง',
      grade: 'ม.6/1',
    });

    const login1 = await makeRequest(server, 'POST', '/api/login', {}, {
      studentId: '556677',
      password: 'Password123!',
    });
    assert.equal(login1.status, 200);
    const cookie1 = login1.headers['set-cookie']?.[0]?.split(';')[0];
    const user1 = login1.body.user;

    // 2. Register User 2
    await makeRequest(server, 'POST', '/api/register', {}, {
      name: 'นภาพร สดใส',
      studentId: '889900',
      password: 'Password123!',
      schoolId: 'thung-song',
      schoolName: 'โรงเรียนทุ่งสง',
      grade: 'ม.6/2',
    });

    const login2 = await makeRequest(server, 'POST', '/api/login', {}, {
      studentId: '889900',
      password: 'Password123!',
    });
    assert.equal(login2.status, 200);
    const cookie2 = login2.headers['set-cookie']?.[0]?.split(';')[0];
    const user2 = login2.body.user;

    // 3. Test Users Search / Discovery API
    const searchRes = await makeRequest(server, 'GET', '/api/users/search?q=นภาพร', { 'Cookie': cookie1 });
    assert.equal(searchRes.status, 200);
    assert.ok(Array.isArray(searchRes.body.users));
    assert.ok(searchRes.body.users.some((u) => u.id === user2.id && u.name === 'นภาพร สดใส'));

    // Test classmate suggestion with empty query
    const suggestRes = await makeRequest(server, 'GET', '/api/users/search', { 'Cookie': cookie1 });
    assert.equal(suggestRes.status, 200);
    assert.ok(suggestRes.body.users.some((u) => u.id === user2.id));

    // 4. Test Typing Indicator API
    const typingRes = await makeRequest(server, 'POST', '/api/messages/typing', { 'Cookie': cookie1 }, {
      toId: user2.id,
      isTyping: true,
    });
    assert.equal(typingRes.status, 200);
    assert.equal(typingRes.body.ok, true);

    // 5. Test SSE Real-time Stream
    const eventsReceived = [];
    let sseReq;
    const ssePromise = new Promise((resolve) => {
      sseReq = http.request(
        {
          hostname: '127.0.0.1',
          port: addr.port,
          path: '/api/realtime/stream',
          method: 'GET',
          headers: {
            'Cookie': cookie2,
            'Accept': 'text/event-stream',
          },
        },
        (res) => {
          assert.equal(res.statusCode, 200);
          assert.ok(res.headers['content-type'].includes('text/event-stream'));
          res.on('data', (chunk) => {
            const text = chunk.toString();
            eventsReceived.push(text);
            if (eventsReceived.some((e) => e.includes('chat_message'))) {
              resolve();
            }
          });
        }
      );
      sseReq.end();
    });

    // Wait a brief moment for SSE connection to establish
    await new Promise((r) => setTimeout(r, 80));

    // User 1 sends message to User 2
    const msgRes = await makeRequest(server, 'POST', '/api/messages', { 'Cookie': cookie1 }, {
      toId: user2.id,
      message: 'สวัสดีครับ นภาพร แชทเรียลไทม์ทดสอบครับ!',
    });
    assert.equal(msgRes.status, 201);

    // Wait for SSE to receive the message
    await Promise.race([
      ssePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 2500)),
    ]);

    assert.ok(eventsReceived.some((e) => e.includes('event: chat_message') && e.includes('แชทเรียลไทม์ทดสอบครับ')));

    if (sseReq) sseReq.destroy();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
