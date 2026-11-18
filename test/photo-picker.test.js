'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const markup = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('photo selection opens the image picker separately from the camera action', () => {
  const photoInput = markup.match(/<input\b(?=[^>]*\bid="photo-file")[^>]*>/s)?.[0];
  assert.ok(photoInput, 'photo file input exists');
  assert.match(photoInput, /\bmultiple\b/);
  assert.doesNotMatch(photoInput, /\bcapture(?:\s|=|>)/i);
  assert.match(markup, /id="camera-open"/);
});
