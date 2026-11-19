import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has no critical or serious axe accessibility violations across main states', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForSelector('#loading-screen.fade-out', { timeout: 20000 });

  const checkAxe = async (label: string): Promise<void> => {
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severe, `Axe violations in ${label}: ${JSON.stringify(severe.map((s) => s.id))}`).toEqual([]);
  };

  // 1. Exterior state
  await checkAxe('Exterior');

  // 2. L1 Isolated + Room InfoPanel
  await page.click('.floor-btn[data-floor-id="L1"]');
  await page.fill('#hospital-search-input', 'Pharmacy');
  await page.click('.search-result-item >> nth=0');
  await checkAxe('L1 InfoPanel');

  // 3. Pharmacy Inspect
  await page.click('#info-enter-btn');
  await page.waitForTimeout(200);
  await checkAxe('Pharmacy');

  // 4. Arabic RTL mode
  await page.click('#btn-settings');
  await page.click('#btn-lang');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await checkAxe('Arabic RTL');
});
