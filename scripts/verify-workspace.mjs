// ponytail: script verify 1-shot cho multi-book workspace — chạy `node scripts/verify-workspace.mjs <port>`
import { createRequire } from 'module';
const require = createRequire('/Users/tdgames_mac01/.npm/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright-core');

const PORT = process.argv[2] || '3004';
const BASE = `http://localhost:${PORT}`;
const USER = 'toan.dang@tdgamestudio.com';
const PASS = process.env.TEST_ADMIN_PASSWORD || 'Toandung@123';
const OUT = '/tmp/claude';
const log = (...a) => console.log('▶', ...a);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // ── Login ──
  await page.fill('input[type="text"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button:has-text("ĐĂNG NHẬP")');
  await page.waitForSelector('text=ĐĂNG NHẬP', { state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  log('after login:', (await page.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' | '));

  const results = {};
  for (const [ws, label] of [['TD GAMES', 'games'], ['TD CONSULTING', 'consult'], ['all', 'all']]) {
    // switcher là <select> trên Navbar — vào dashboard trước để có Navbar
    await page.goto(`${BASE}/#dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const sel = page.locator('select:has(option[value="all"])').first();
    const switcherVisible = await sel.isVisible().catch(() => false);
    if (!switcherVisible) { log('❌ switcher KHÔNG hiện trên navbar'); break; }
    await sel.selectOption(ws);
    await page.waitForTimeout(4000);
    const selValue = await sel.inputValue();
    const kpi = await page.locator('h1:has-text("CEO Dashboard") + span').innerText().catch(() => '?');
    await page.screenshot({ path: `${OUT}/dash-${label}.png` });

    // Expense list
    await page.goto(`${BASE}/#expense`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const expText = (await page.locator('body').innerText());
    const tdcBadges = await page.locator('text=TDC').count();
    await page.screenshot({ path: `${OUT}/expense-${label}.png` });

    // Invoice history
    await page.goto(`${BASE}/#invoice/history`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    const invRows = await page.locator('table tbody tr').count().catch(() => -1);
    await page.screenshot({ path: `${OUT}/invoice-${label}.png` });

    results[ws] = { selValue, headerNote: kpi, tdcBadges, invRows };
    log(ws, '→', JSON.stringify(results[ws]));
  }
  console.log('\nRESULTS', JSON.stringify(results, null, 1));
} catch (e) {
  console.error('FAIL:', e.message);
  await page.screenshot({ path: `${OUT}/fail.png` }).catch(() => {});
} finally {
  await browser.close();
}
