import { test, expect } from '@playwright/test';

test.describe('Rubble gameplay visibility', () => {
  test('canvas visible, sized, and HUD layered', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('rubble:auto-start', '1');
        window.localStorage.setItem(
          'rubble_first_run_v1',
          JSON.stringify({ tapped: true, perfect: true, burst: true })
        );
        window.localStorage.setItem('rubble:tutorial-pref', JSON.stringify({ dismissed: true }));
      } catch {
        // ignore storage access errors
      }
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const inner = page.locator('.app-frame__inner');
    await expect(inner).toBeVisible();

    const box = await inner.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(100);
    expect(box?.height || 0).toBeGreaterThan(100);

    const canvas = page.locator('canvas.app-canvas');
    await expect(canvas).toBeVisible();

    const hud = page.locator('.app-hud');
    await expect(hud.getByRole('button', { name: /pause/i })).toBeVisible();
    const hudZ = await hud.evaluate((el) => getComputedStyle(el).zIndex);
    const canvasZ = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(parseInt(hudZ || '0')).toBeGreaterThan(parseInt(canvasZ || '0'));

    const overflowState = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(['hidden', 'clip']).toContain(overflowState);

    await page.evaluate(() => {
      localStorage.setItem('rubble:diag', 'true');
      localStorage.setItem('rubble:auto-start', '1');
      localStorage.setItem('rubble_first_run_v1', JSON.stringify({ tapped: true, perfect: true, burst: true }));
      localStorage.setItem('rubble:tutorial-pref', JSON.stringify({ dismissed: true }));
      location.reload();
    });
    await page.waitForLoadState('domcontentloaded');
    const diag = page.locator('.rbl-diag');
    await expect(diag).toBeVisible();
    const diagText = await diag.textContent();
    console.log('DIAG:', diagText);

    expect(diagText || '').toMatch(/DPR/i);
    expect(diagText || '').toMatch(/CSS/i);
  });
});
