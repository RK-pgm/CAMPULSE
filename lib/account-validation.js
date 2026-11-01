'use strict';

function isValidStudentId(value, { adminCandidate = false, staffStudentId = '' } = {}) {
  const studentId = String(value || '').trim();
  return Boolean(/^\d{4,12}$/.test(studentId)
    || adminCandidate
    || (staffStudentId && studentId.toLowerCase() === String(staffStudentId).trim().toLowerCase()));
}

function isStrongPassword(value) {
  const password = String(value || '');
  return password.length >= 10 && password.length <= 128
    && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

module.exports = { isValidStudentId, isStrongPassword };
