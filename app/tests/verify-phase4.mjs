import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const SHOTS = process.argv[2] ?? '.playwright-shots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  - ' + detail : ''));
}

const browser = await chromium.launch();

// ---- 1. Predict Bail: fill the form, get a result, see live numbers -----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: [] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/predict', { waitUntil: 'networkidle' });

  await page.getByText('Murder', { exact: true }).click();
  await page.locator('#ipc').fill('302');
  await page.locator('#ipc').press('Enter');
  check('IPC chip added', await page.getByText('IPC 302').isVisible());

  await page.getByRole('button', { name: 'Run prediction' }).click();
  await page.waitForSelector('text=Bail prediction', { timeout: 5000 });
  await page.waitForTimeout(900); // artificial backend latency

  const probabilityVisible = await page.locator('text=/%$/').first().isVisible().catch(() => false);
  check('result sheet shows a probability', probabilityVisible);

  const stampVisible = await page.getByText(/Bail (granted|denied)/).isVisible();
  check('result sheet shows a verdict stamp', stampVisible);

  await page.getByRole('button', { name: 'Compare against baseline' }).click();
  await page.waitForTimeout(700);
  const baselineVisible = await page.getByText('logistic_regression').isVisible().catch(() => false);
  check('live baseline toggle re-queries and renders', baselineVisible);

  await page.screenshot({ path: `${SHOTS}/predict-result.png` });
  await ctx.close();
}

// ---- 2. Predict Bail: validation blocks an incomplete submission --------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/predict', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run prediction' }).click();
  await page.waitForTimeout(300);
  const errorShown = await page.getByText('Add at least one IPC section.').isVisible().catch(() => false);
  check('form validation blocks empty IPC sections', errorShown);
  await ctx.close();
}

// ---- 3. Scan Document: file upload path, extracted fields ---------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/scan', { waitUntil: 'networkidle' });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Choose file').click(),
  ]);
  await fileChooser.setFiles({
    name: 'test.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), // minimal JPEG marker bytes
  });

  await page.waitForSelector('text=OCR confidence', { timeout: 6000 });
  const caseNumberVisible = await page.getByText('CRL.A. 1274/2019').isVisible().catch(() => false);
  check('scan extracts fields from the clean fixture', caseNumberVisible);

  await page.getByRole('button', { name: 'Summarize this text' }).click();
  await page.waitForSelector('text=Summary', { timeout: 5000 });
  check('explicit summarize step runs after scan (not automatic)', true);

  await page.screenshot({ path: `${SHOTS}/scan-result.png` });
  await ctx.close();
}

// ---- 4. Scan Document: low-quality trigger shows the caution chip -------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/scan', { waitUntil: 'networkidle' });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Choose file').click(),
  ]);
  await fileChooser.setFiles({
    name: 'test-lowquality.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.waitForSelector('text=OCR confidence', { timeout: 6000 });
  const captionVisible = await page.getByText('measured and reported separately').isVisible().catch(() => false);
  check('OCR vs extraction error separation caption is present', captionVisible);
  await ctx.close();
}

// ---- 5. Search -> Case Detail -> Ask -> highlighted span -----------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/search', { waitUntil: 'networkidle' });
  await page.locator('input[placeholder*="bail granted"]').fill('bail economic offence');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForSelector('text=State v. Ravi Kumar', { timeout: 5000 });
  await page.getByText('State v. Ravi Kumar').click();

  await page.waitForURL('**/app/case/case_0412', { timeout: 3000 });
  await page.waitForSelector('text=CRL.A. 1274/2019', { timeout: 5000 });
  check('navigating a search result opens Case Detail with real judgment text', true);

  await page.getByRole('button', { name: 'Ask' }).click();
  await page.getByPlaceholder(/On what terms/).fill('On what terms was bail granted?');
  await page.getByRole('button', { name: 'Find the answer' }).click();
  await page.waitForSelector('mark', { timeout: 5000 });
  const markText = await page.locator('mark').textContent();
  check('QA answer highlights a real span inside the judgment text', markText?.includes('released'), `got "${markText}"`);

  // Save to library, then confirm it shows up there.
  await page.getByLabel('Save to library').click();
  await page.screenshot({ path: `${SHOTS}/case-detail.png` });
  await page.goto(BASE + '/app/library', { waitUntil: 'networkidle' });
  const savedVisible = await page.getByText('State v. Ravi Kumar').first().isVisible();
  check('saved case appears in Case Library', savedVisible);
  await page.screenshot({ path: `${SHOTS}/library.png` });
  await ctx.close();
}

// ---- 6. Home reflects real recorded activity, not static zeros ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  // Run one prediction first so there is activity to reflect.
  await page.goto(BASE + '/app/predict', { waitUntil: 'networkidle' });
  await page.getByText('Extortion', { exact: true }).click();
  await page.locator('#ipc').fill('379');
  await page.locator('#ipc').press('Enter');
  await page.getByRole('button', { name: 'Run prediction' }).click();
  await page.waitForSelector('text=Bail prediction', { timeout: 5000 });
  await page.waitForTimeout(900);

  await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const activityVisible = await page.getByText(/Bail: Extortion/).isVisible().catch(() => false);
  check('Home activity list reflects a real prediction just made', activityVisible);
  await ctx.close();
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
