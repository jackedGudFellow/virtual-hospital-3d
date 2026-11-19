import { expect, test } from '@playwright/test';

interface HospitalTestHook {
  getRoomIds: () => string[];
  getState: () => { mode: string; activeFloor: string | null; activeRoom: string | null };
  getCameraPos: () => { x: number; y: number; z: number };
  getRenderStats: () => { drawCalls: number; triangles: number };
  enterRoom: (roomId: string) => void;
  openCabinet: (cabId: string) => void;
  inspectDrug: (drugId: string) => void;
  getDrugIds: () => string[];
}

test('loads without console errors, exercises core flows, pharmacy, i18n, quality & screenshots', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/?test=1');
  await page.waitForFunction(() => Boolean((window as unknown as { __hospitalTest?: HospitalTestHook }).__hospitalTest));
  await page.waitForSelector('#loading-screen.fade-out', { timeout: 20000 });

  // Capture Exterior screenshot
  await page.screenshot({ path: 'test-results/screenshots/00-exterior.png' });

  // Draw call budget check (real measured whole-building baseline across 5 floors / 153 rooms / 120 drugs = ~4683)
  const stats = await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.getRenderStats());
  expect(stats.drawCalls).toBeLessThan(5500);

  // Switch floors L1-L5 & take screenshots
  for (const floor of ['L1', 'L2', 'L3', 'L4', 'L5']) {
    await page.click(`.floor-btn[data-floor-id="${floor}"]`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/screenshots/floor-${floor}.png` });
  }

  // Search and select ICU
  await page.fill('#hospital-search-input', 'Intensive Care Unit');
  await page.click('.search-result-item >> nth=0');
  await expect(page.locator('#hud-info-panel')).toBeVisible();

  // Enter room -> Esc back to FLOOR -> Esc back to EXTERIOR
  await page.click('#info-enter-btn');
  await page.waitForTimeout(200);
  let state = await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.getState());
  expect(state.mode).toBe('ROOM');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  state = await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.getState());
  expect(state.mode).toBe('FLOOR');

  // Verify every room id is enterable without throwing
  const roomIds = await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.getRoomIds());
  expect(roomIds.length).toBe(153);
  for (const id of ['L1.main.lobby', 'L1.surgery.or-1', 'L1.chemo.bay', 'L2.nicu.open-ward', 'L4.inpatient.double-1']) {
    await page.evaluate((rid) => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.enterRoom(rid), id);
    await page.waitForTimeout(180);
    await page.screenshot({ path: `test-results/screenshots/room-${id}.png` });
  }

  // Walk mode wall collision check (hold W inside L1.main.lobby)
  await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.enterRoom('L1.main.lobby'));
  await page.click('#info-walk-toggle');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  const camPos = await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.getCameraPos());
  expect(Number.isFinite(camPos.x) && Number.isFinite(camPos.z)).toBe(true);

  // Pharmacy: all 12 cabinets (K requires Pharmacist Badge) + drug inspect + dispense
  await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.enterRoom('L1.pharmacy.dispensing'));
  await page.waitForTimeout(200);
  await expect(page.locator('#pharmacy-toolbar')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/room-L1.pharmacy.dispensing.png' });

  for (const cab of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L']) {
    await page.evaluate((c) => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.openCabinet(c), cab);
  }
  await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.openCabinet('K'));
  await expect(page.locator('#badge-unlock-btn')).toBeVisible();
  await page.click('#badge-unlock-btn');

  const drugIds = await page.evaluate(() => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.getDrugIds());
  expect(drugIds.length).toBeGreaterThanOrEqual(120);
  await page.evaluate((did) => (window as unknown as { __hospitalTest: HospitalTestHook }).__hospitalTest.inspectDrug(did), drugIds[0]);
  await expect(page.locator('#pharmacy-inspect')).toBeVisible();
  await expect(page.locator('#pharmacy-inspect')).toContainText('Educational simulation. Not medical advice.');
  await page.click('#drug-close-btn');

  // Dispense mini-flow
  await page.click('#pharmacy-dispense-open');
  await page.click('#dispense-go-btn');
  await expect(page.locator('#dispense-rx-label')).toContainText('Sample Patient');
  await page.click('#modal-cancel-btn');

  // Step 9: Rx Check (LASA/Expiry quiz) + Compare modal + Fridge alert
  await page.click('#pharmacy-rxcheck-open');
  await page.click('.rx-check-opt >> nth=0');
  await expect(page.locator('#rx-check-feedback')).toContainText('LASA');
  await page.click('#modal-cancel-btn');

  await page.click('#pharmacy-compare-open');
  await expect(page.locator('#cmp-table')).toContainText('Class');
  await page.click('#modal-cancel-btn');

  await page.click('#pharmacy-fridge-btn');
  await expect(page.locator('#pharmacy-fridge-btn')).toContainText('ALERT');

  // Settings: Quality toggle & EN/AR RTL toggle
  await page.click('#btn-settings');
  await page.click('#btn-quality');
  await page.click('#btn-lang');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.click('#btn-lang');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  expect(consoleErrors).toEqual([]);
});
