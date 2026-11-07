'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

process.env.VERCEL = '1';
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
process.env.SUPABASE_ALLOW_EMPTY_STORE = 'true';
process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-test-token';
process.env.SESSION_SECRET = 'session-test-secret';

const requests = [];
let store;
global.fetch = async (input, options = {}) => {
  const url = String(input);
  requests.push(url);
  if (!url.startsWith(process.env.SUPABASE_URL)) {
    return Response.json({ error: 'reached current plan limits' }, { status: 400 });
  }
  if (url.includes('/rpc/campulse_acquire_lock')) return Response.json(true);
  if (url.includes('/rpc/campulse_release_lock')) return Response.json(null);
  if (url.includes('/campulse_store') && options.method === 'POST') {
    store = JSON.parse(options.body)[0].store;
    return new Response(null, { status: 201 });
  }
  if (url.includes('/campulse_store') && (!options.method || options.method === 'GET')) {
    return Response.json(store ? [{ store }] : []);
  }
  throw new Error(`Unexpected Supabase request: ${url}`);
};

const handler = require('../server');

test('empty-store mode seeds Supabase without reading exhausted Upstash', async (t) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  requests.length = 0;

  const response = await new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: '/api/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (result) => {
      let body = '';
      result.setEncoding('utf8');
      result.on('data', (chunk) => { body += chunk; });
      result.on('end', () => resolve({ status: result.statusCode, body }));
    });
    request.on('error', reject);
    request.end(JSON.stringify({ studentId: '1234', password: 'not-a-real-password' }));
  });

  assert.equal(response.status, 401);
  assert.deepEqual(store, {
    users: [],
    items: [],
    messages: [],
    staffMessages: [],
    comments: [],
    notifications: [],
    claims: [],
    itemReports: [],
    savedSearches: [],
    pointLedger: [],
    workOrders: [],
    restaurants: [],
    restaurantRatings: [],
    friends: [],
    userReviews: [],
  });
  assert.ok(requests.length > 0);
  assert.ok(requests.every((url) => url.startsWith(process.env.SUPABASE_URL)));
});
