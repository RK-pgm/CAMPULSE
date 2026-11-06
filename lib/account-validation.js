'use strict';

function isValidStudentId(value, { adminCandidate = false, staffStudentId = '' } = {}) {
  const studentId = String(value || '').trim();
  return Boolean(/^\d{4,12}$/.test(studentId)
    || adminCandidate
    || (staffStudentId && studentId.toLowerCase() === String(staffStudentId).trim().toLowerCase()));
}

function isStrongPassword(value) {
  const password = String(value || '');
  const characterCount = [...password].length;
  return characterCount >= 10 && characterCount <= 128
    && /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password) && /\p{N}/u.test(password);
}

module.exports = { isValidStudentId, isStrongPassword };
