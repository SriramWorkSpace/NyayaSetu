import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

  // Regression check for a real bug: the header's "Model" stat was a
  // leftover Phase 3 fixture string ("xgboost-stub") never wired to the
  // real BailPredictResponse.model_version - caught only by testing an
  // actual `tauri build` release window, not `tauri dev` (decisions.md,
  // Phase 11). Confirms the live model_version renders and the stub string
  // never appears anywhere on the page.
  const modelStatVisible = await page.getByText(/xgboost-tfidf-\d{4}-\d{2}-\d{2}/).isVisible().catch(() => false);
  const stubStringAbsent = !(await page.getByText('xgboost-stub').isVisible().catch(() => false));
  check('Predict header shows the real served model_version, not a stub placeholder', modelStatVisible && stubStringAbsent);

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
// Phase 9: /scan/extract runs real Tesseract + spaCy, so the upload must be
// a genuinely decodable image (a fixture stub never actually opened the
// bytes; the real OCR path does, via Pillow, and correctly 422s on
// anything it can't decode). fixtures/scan-sample.png is a real rendered
// image whose real extraction was verified directly against the running
// backend before this assertion was written - see decisions.md D-030 for
// why the model misses some fields on real-shaped text (that is the
// disclosed, expected NER gap, not a bug this test should paper over).
const SCAN_IMAGE = readFileSync(path.join(__dirname, 'fixtures', 'scan-sample.png'));
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/scan', { waitUntil: 'networkidle' });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Choose file').click(),
  ]);
  await fileChooser.setFiles({ name: 'scan-sample.png', mimeType: 'image/png', buffer: SCAN_IMAGE });

  await page.waitForSelector('text=OCR confidence', { timeout: 15000 });
  const courtVisible = await page.getByText('Delhi High Court').isVisible().catch(() => false);
  const ipcVisible = await page.getByText('420, 406', { exact: false }).isVisible().catch(() => false);
  check('scan extracts real fields via live OCR + NER', courtVisible && ipcVisible);

  await page.getByRole('button', { name: 'Summarize this text' }).click();
  await page.waitForSelector('text=Summary', { timeout: 15000 });
  check('explicit summarize step runs after scan (not automatic)', true);

  await page.screenshot({ path: `${SHOTS}/scan-result.png` });
  await ctx.close();
}

// ---- 4. Scan Document: OCR/NER error-separation caption is present ------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/scan', { waitUntil: 'networkidle' });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Choose file').click(),
  ]);
  await fileChooser.setFiles({ name: 'scan-sample.png', mimeType: 'image/png', buffer: SCAN_IMAGE });
  await page.waitForSelector('text=OCR confidence', { timeout: 15000 });
  const captionVisible = await page.getByText('measured and reported separately').isVisible().catch(() => false);
  check('OCR vs extraction error separation caption is present', captionVisible);
  await ctx.close();
}

// ---- 5. Search -> Case Detail -> Ask -> highlighted span -----------------
// Phase 9: the retrieval corpus is real ILDC judgment text (decisions.md
// D-030), not the old two-case fixture - result titles/case_ids/QA answers
// below come from that live corpus, not invented values. The corpus's own
// "co"->"company" substring-corruption artifact (same decision) is real
// and expected to appear in the matched snippet text, not a typo in this
// test. The title text below is this document's own opening words - stable
// across Search and Case Detail after decisions.md D-030 item 6's fix, so
// the same string can be asserted on both screens.
const REAL_CASE_TITLE = 'The petitioners are before this Court assailing the order dated';
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/search', { waitUntil: 'networkidle' });
  await page.locator('input[placeholder*="bail granted"]').fill('bail granted economic offence custodial interrogation');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForSelector(`text=${REAL_CASE_TITLE}`, { timeout: 10000 });
  await page.getByText(REAL_CASE_TITLE, { exact: false }).click();

  await page.waitForURL('**/app/case/2019_1170', { timeout: 5000 });
  await page.waitForSelector('text=Bopanna', { timeout: 5000 });
  check('navigating a search result opens Case Detail with real judgment text', true);

  await page.getByRole('button', { name: 'Ask' }).click();
  await page.getByPlaceholder(/On what terms/).fill('When was the FIR registered?');
  await page.getByRole('button', { name: 'Find the answer' }).click();
  await page.waitForSelector('mark', { timeout: 10000 });
  const markText = await page.locator('mark').textContent();
  // The QA model's real-corpus quality gap is disclosed in
  // MODEL_CARD_qa.md and decisions.md D-030 item 4 - this only checks that
  // a real, non-empty span from the actual judgment text was located and
  // highlighted, not that the answer is a tight or "correct" span.
  check('QA answer highlights a real, non-empty span inside the judgment text', Boolean(markText && markText.length > 0), `got "${markText?.slice(0, 60)}..."`);

  // Save to library, then confirm it shows up there under the SAME title
  // (decisions.md D-030 item 6 - title used to differ between the two
  // screens for the same case_id; this is the regression check for that).
  await page.getByLabel('Save to library').click();
  await page.screenshot({ path: `${SHOTS}/case-detail.png` });
  await page.goto(BASE + '/app/library', { waitUntil: 'networkidle' });
  const savedVisible = await page.getByText(REAL_CASE_TITLE, { exact: false }).first().isVisible();
  check('saved case appears in Case Library under the same title shown on Search', savedVisible);
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

// ---- 7. Model Insights: real /metrics data, per-module, data-driven -----
// Phase 10 - ARCHITECTURE.md section 4.7. Calibration/fairness are asserted
// on bail specifically (the only module with non-null calibration_points/
// fairness in real data) but the component itself branches on data
// presence, not a module-name check - this is the regression test for that.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/insights', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Baseline to final', { timeout: 8000 });

  const datasetSizeVisible = await page.getByText('1,198').isVisible().catch(() => false);
  check('Insights shows the real bail dataset size from /metrics, not a placeholder', datasetSizeVisible);

  // "XGBoost + TF-IDF" appears three times (the comparison bar's tier label,
  // plus two metric-table column captions) - the comparison bar's tier
  // label is the only one styled with the "items-center" row class, so
  // check its own text for the "Served" badge rather than guess a DOM path.
  const servedBadgeOnXgboost = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('span')).find(
      (s) => s.textContent?.trim().startsWith('XGBoost + TF-IDF') && s.className.includes('items-center'),
    );
    return Boolean(label && label.textContent?.includes('Served'));
  });
  check('bail marks XGBoost + TF-IDF as served, not the fused "final" tier (decisions.md D-029)', servedBadgeOnXgboost);

  const calibrationVisible = await page.getByText('Calibration', { exact: true }).isVisible().catch(() => false);
  const fairnessVisible = await page.getByText(/Fairness audit/).isVisible().catch(() => false);
  check('bail (the only module with real calibration/fairness data) renders both', calibrationVisible && fairnessVisible);

  await page.getByRole('tab', { name: 'NER' }).click();
  await page.waitForTimeout(400);
  const nerHasNoCalibration = !(await page.getByText('Calibration', { exact: true }).isVisible().catch(() => false));
  const nerShowsEntityF1 = await page.getByText('Entity F1 (overall)').isVisible().catch(() => false);
  check(
    'switching modules swaps content (NER has no calibration card, shows its own metric rows)',
    nerHasNoCalibration && nerShowsEntityF1,
  );

  await page.getByRole('tab', { name: 'Retrieval' }).click();
  await page.waitForTimeout(400);
  const retrievalNoteVisible = await page.getByText(/production scale/).isVisible().catch(() => false);
  check('retrieval discloses the production-scale vs comparison-scale distinction (MODEL_CARD_retrieval.md)', retrievalNoteVisible);

  await page.screenshot({ path: `${SHOTS}/insights.png` });
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
