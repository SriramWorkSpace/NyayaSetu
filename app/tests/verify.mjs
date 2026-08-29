import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const SHOTS = process.argv[2];
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  - ' + detail : ''));
}

const ROUTES = [
  ['/', 'startup'],
  ['/app', 'home'],
  ['/app/predict', 'predict'],
  ['/app/scan', 'scan'],
  ['/app/search', 'search'],
  ['/app/library', 'library'],
  ['/app/insights', 'insights'],
  ['/sandbox', 'sandbox'],
];

const browser = await chromium.launch();

// ---- 1. Console/page errors across every route, both themes -------------
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 832 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  for (const [path, name] of ROUTES) {
    errors.length = 0;
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    check(`no console errors: ${name} (${theme})`, errors.length === 0, errors.join(' | '));
  }
  await ctx.close();
}

// ---- 2. Theme toggle actually flips data-theme and persists -------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' });
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('label.switch-label');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('theme toggle flips data-theme', before !== after, `${before} -> ${after}`);

  await page.reload({ waitUntil: 'networkidle' });
  const persisted = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('theme choice persists across reload', persisted === after, `expected ${after}, got ${persisted}`);

  const box = await page.locator('.toggle-switch').boundingBox();
  const vw = page.viewportSize().width;
  check('theme toggle sits near top-right', box && box.x > vw - 200 && box.y < 80, JSON.stringify(box));
  await ctx.close();
}

// ---- 3. Nav rail: collapsed width clears icons, hover expands + pushes --
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 760 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app', { waitUntil: 'networkidle' });

  const nav = page.locator('nav[aria-label="Primary"]');
  const collapsedBox = await nav.boundingBox();
  check('rail collapsed width >= 64px', collapsedBox.width >= 64, `${collapsedBox.width}px`);

  const main = page.locator('main');
  const mainBoxBefore = await main.boundingBox();

  await nav.hover();
  await page.waitForTimeout(400);
  const expandedBox = await nav.boundingBox();
  const mainBoxAfter = await main.boundingBox();

  check('rail expands on hover', expandedBox.width > collapsedBox.width + 40,
    `${collapsedBox.width}px -> ${expandedBox.width}px`);
  check('content is PUSHED not covered (main.x shifts right)', mainBoxAfter.x > mainBoxBefore.x + 40,
    `main.x ${mainBoxBefore.x} -> ${mainBoxAfter.x}`);

  const icon = nav.locator('svg').first();
  const iconBox = await icon.boundingBox();
  const withinRail = iconBox.x >= collapsedBox.x && (iconBox.x + iconBox.width) <= (collapsedBox.x + collapsedBox.width);
  check('nav icon fits inside collapsed rail (not clipped)', withinRail, JSON.stringify({ iconBox, collapsedBox }));

  await ctx.close();
}

// ---- 4. All six nav destinations are reachable and render their title ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app', { waitUntil: 'networkidle' });

  const expectedTitles = {
    '/app': 'Chambers',
    '/app/predict': 'Predict Bail',
    '/app/scan': 'Scan Document',
    '/app/search': 'Search Precedent',
    '/app/library': 'Case Library',
    '/app/insights': 'Model Insights',
  };
  for (const [path, title] of Object.entries(expectedTitles)) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const h1 = await page.locator('h1').first().textContent();
    check(`route ${path} renders title "${title}"`, h1?.trim() === title, `got "${h1?.trim()}"`);
  }
  await ctx.close();
}

// ---- 5. Startup -> Enter the Suite -> lands on /app ----------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const enterBtn = page.getByRole('button', { name: 'Enter NyayaSetu' });
  await enterBtn.waitFor({ state: 'visible', timeout: 5000 });
  await enterBtn.click();
  await page.waitForURL('**/app', { timeout: 3000 });
  check('Enter the Suite navigates to /app', page.url().endsWith('/app'));
  await ctx.close();
}

// ---- 6. Window-resize sanity (1024 <-> 1600), no horizontal overflow -----
for (const width of [1024, 1600]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/predict', { waitUntil: 'networkidle' });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`no horizontal overflow at ${width}px`, scrollWidth <= width + 1, `scrollWidth=${scrollWidth}`);
  await ctx.close();
}

// Insights has its own overflow risk (a metric table and a calibration
// chart) not covered by Predict above - checked separately, on real data.
for (const width of [1024, 1600]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/insights', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Baseline to final', { timeout: 8000 });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`Insights: no horizontal overflow at ${width}px`, scrollWidth <= width + 1, `scrollWidth=${scrollWidth}`);
  await ctx.close();
}

// ---- 7. Reduced motion: typewriter resolves instantly on Startup --------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
  const text = await page.locator('h1').first().textContent();
  check('typewriter shows full text immediately under reduced motion', text?.includes('NyayaSetu'), `got "${text}"`);
  await ctx.close();
}

// ---- 8. End to end: Home actually round-trips to the live backend --------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const subtitle = await page.locator('header p').first().textContent();
  check('Home connects to the live backend over the typed client', subtitle?.includes('connected'), `got "${subtitle}"`);
  const backendPill = page.locator('text=BACKEND').locator('..');
  const pillText = await backendPill.textContent().catch(() => null);
  check('stat pill shows live backend status, not hardcoded', pillText?.toLowerCase().includes('ok'), `got "${pillText}"`);
  await ctx.close();
}

// ---- Screenshots for visual record ---------------------------------------
{
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const [path, name] of ROUTES) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/${name}-${theme}.png`, fullPage: false });
    }
    await ctx.close();
  }
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log('\n' + '='.repeat(60));
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
  process.exitCode = 1;
}
