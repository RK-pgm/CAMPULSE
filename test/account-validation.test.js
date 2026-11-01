'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidStudentId, isStrongPassword } = require('../lib/account-validation');

test('accepts only 4–12 digit student IDs except guarded admin and configured staff IDs', () => {
  assert.equal(isValidStudentId('1234'), true);
  assert.equal(isValidStudentId('123456789012'), true);
  assert.equal(isValidStudentId('123'), false);
  assert.equal(isValidStudentId('1234567890123'), false);
  assert.equal(isValidStudentId('A1010'), false);
  assert.equal(isValidStudentId('T36699', { adminCandidate: true }), true);
  assert.equal(isValidStudentId('STAFF-01', { staffStudentId: 'staff-01' }), true);
});

test('requires a long mixed-case password with a number', () => {
  assert.equal(isStrongPassword('Schoolpass1'), true);
  assert.equal(isStrongPassword('short1A'), false);
  assert.equal(isStrongPassword('lowercaseonly1'), false);
  assert.equal(isStrongPassword('UPPERCASEONLY1'), false);
  assert.equal(isStrongPassword('Schoolpassword'), false);
});
