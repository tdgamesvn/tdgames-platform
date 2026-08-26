#!/usr/bin/env node
/**
 * Whitelist cột nhân viên tự sửa nằm ở hai nơi phải khớp nhau:
 *   - client: EMPLOYEE_EDITABLE_FIELDS trong apps/portal/services/portalService.ts
 *   - DB:     trigger hr_employees_guard_self_update trong supabase/migrations/
 * Lệch nhau thì form Portal lưu êm ru mà DB âm thầm giữ giá trị cũ — không lỗi, không log,
 * chỉ có nhân viên thắc mắc sao sửa xong không đổi. Script này bắt đúng cái lệch đó.
 *
 * Chạy: node scripts/test-column-guards.mjs   (không cần DB, chỉ đọc file)
 */
import { readFileSync, readdirSync } from 'node:fs';

// Cột client không gửi nhưng DB phải cho qua.
const DB_ONLY = ['onboarding_completed_at', 'updated_at'];

const ts = readFileSync('apps/portal/services/portalService.ts', 'utf8');
const tsBlock = /EMPLOYEE_EDITABLE_FIELDS\s*=\s*\[([\s\S]*?)\]/.exec(ts);
if (!tsBlock) throw new Error('Không tìm thấy EMPLOYEE_EDITABLE_FIELDS trong portalService.ts');
const clientCols = [...tsBlock[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

// Lấy bản CREATE TRIGGER mới nhất theo thứ tự migration (tên file có tiền tố ngày).
const dir = 'supabase/migrations';
let sqlCols = null;
for (const f of readdirSync(dir).sort()) {
  const re = /CREATE TRIGGER hr_employees_guard_self_update[\s\S]*?'\{([^}]+)\}'/g;
  for (const m of readFileSync(`${dir}/${f}`, 'utf8').matchAll(re)) {
    sqlCols = m[1].split(',').map((c) => c.trim().replace(/^'|'$/g, ''));
  }
}
if (!sqlCols) throw new Error('Không tìm thấy trigger hr_employees_guard_self_update trong migrations');

const expected = [...clientCols, ...DB_ONLY];
const missing = expected.filter((c) => !sqlCols.includes(c));
const extra = sqlCols.filter((c) => !expected.includes(c));

if (missing.length || extra.length) {
  console.error('❌ Whitelist lệch giữa portalService.ts và trigger DB:');
  if (missing.length) console.error(`   Client sửa được nhưng DB CHẶN (mất dữ liệu êm): ${missing.join(', ')}`);
  if (extra.length) console.error(`   DB cho qua nhưng client không gửi (hở quyền): ${extra.join(', ')}`);
  process.exit(1);
}
console.log(`✅ Whitelist khớp — ${clientCols.length} cột client + ${DB_ONLY.length} cột DB-only.`);
