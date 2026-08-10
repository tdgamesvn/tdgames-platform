#!/usr/bin/env node
// Nút "Verify Emails" đọc các field này từ GET /api/email/verify-pending-status.
// Backend đổi tên field => UI lại hiện "undefined" như bug 21/07. Chạy: node scripts/check-verify-status-shape.mjs
import assert from 'node:assert';

const BASE = process.env.OUTREACH_API_URL || 'https://app.tdgamestudio.com/outreach-api';
const s = await (await fetch(`${BASE}/api/email/verify-pending-status`)).json();

for (const f of ['verified', 'valid', 'invalid', 'high_risk', 'current', 'total']) {
  assert.equal(typeof s[f], 'number', `field "${f}" phải là number, đang là ${typeof s[f]} (${s[f]})`);
}
assert.equal(typeof s.running, 'boolean', 'field "running" phải là boolean');
assert.ok('started_at' in s, 'thiếu "started_at" — mất mốc phân biệt run cũ/mới, poll sẽ ăn kết quả cũ');

console.log(`OK — running=${s.running} ${s.current}/${s.total}, valid=${s.valid} invalid=${s.invalid} started_at=${s.started_at}`);
