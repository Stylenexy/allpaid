import { chromium } from 'playwright';
// Attach to the shared Chrome only. Never launch a new profile.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const base = process.argv[2] || 'https://allpaid.vercel.app';
const errors = [];
for (const [w, h, tag] of [[1440, 900, '1440'], [360, 780, '360']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} ${m.text()}`); });
  for (const path of ['/', '/try']) {
    await page.goto(base + path, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(3000);
    const name = path === '/' ? 'home' : path.slice(1);
    await page.screenshot({ path: `docs/shots/live/${name}-${tag}.png` });
    await page.screenshot({ path: `docs/shots/live/${name}-${tag}-full.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) errors.push(`${tag} ${path} horizontal overflow`);
  }
  await ctx.close();
}
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
