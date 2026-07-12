// ponytail: verify 1-shot cho full-company-separation — node scripts/verify-two-books.mjs <port>
import { createRequire } from 'module';
const require = createRequire('/Users/tdgames_mac01/.npm/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright-core');

const PORT = process.argv[2] || '3008';
const BASE = `http://localhost:${PORT}`;
const USER = 'toan.dang@tdgamestudio.com';
const PASS = process.env.TEST_ADMIN_PASSWORD || 'Toandung@123';
const log = (...a) => console.log('▶', ...a);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button:has-text("ĐĂNG NHẬP")');
  await page.waitForSelector('text=ĐĂNG NHẬP', { state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  log('logged in');

  const switcher = () => page.locator('select:has(option[value="TD GAMES"])').first();

  // Switcher không còn option 'all'
  await page.goto(`${BASE}/#dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const optAll = await page.locator('select option[value="all"]').count();
  log(`option "all" trên navbar: ${optAll} (kỳ vọng 0)`);

  for (const ws of ['TD GAMES', 'TD CONSULTING']) {
    await page.goto(`${BASE}/#dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await switcher().selectOption(ws);
    await page.waitForTimeout(3500);
    const label = await page.locator('h1:has-text("CEO Dashboard") + span').innerText().catch(() => '?');
    log(`[${ws}] dashboard label: "${label}"`);

    for (const [hash, name] of [['#hr', 'hr'], ['#expense', 'expense'], ['#invoice/history', 'invoice'], ['#workforce', 'workforce'], ['#crm', 'crm']]) {
      await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3500);
      const rows = await page.locator('table tbody tr').count().catch(() => -1);
      const body = (await page.locator('body').innerText()).length;
      log(`[${ws}] ${name}: rows=${rows} bodyLen=${body}`);
    }
  }

  // Dashboard Hợp nhất toggle
  await page.goto(`${BASE}/#dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Hợp nhất")');
  await page.waitForTimeout(3500);
  const label = await page.locator('h1:has-text("CEO Dashboard") + span').innerText().catch(() => '?');
  log(`toggle Hợp nhất → label: "${label}" (kỳ vọng chứa "hợp nhất")`);
} finally {
  await browser.close();
}
