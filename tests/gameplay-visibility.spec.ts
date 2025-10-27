import { test, expect } from '@playwright/test';

test.describe('Rubble gameplay visibility', () => {
  test('canvas fills frame with responsive HUD and diagnostics toggle', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';
    await page.addInitScript(() => {
      window.localStorage.setItem('rubble:autoplay', 'true');
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const frameInner = page.locator('.app-frame__inner');
    await expect(frameInner).toBeVisible();

    const frameBox = await frameInner.boundingBox();
    expect(frameBox?.width || 0).toBeGreaterThan(120);
    expect(frameBox?.height || 0).toBeGreaterThan(160);

    await page.waitForFunction(
      () => document.getElementById('rubble-root')?.getAttribute('data-screen') === 'PLAYING',
    );

    const canvas = page.locator('canvas.app-canvas');
    await expect(canvas).toBeVisible();

    const hud = page.locator('.app-hud');
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-hud');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const activeScreens = page.locator('[data-active-screen="true"]');
    await expect(activeScreens).toHaveCount(1);

    const hudZ = await hud.evaluate((el) => getComputedStyle(el).zIndex);
    const canvasZ = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(parseInt(hudZ || '0')).toBeGreaterThan(parseInt(canvasZ || '0'));

    await expect(page.locator('[data-testid="hud-score"]')).toContainText(/\d/);
    await expect(page.locator('[data-testid="hud-combo"]')).toContainText(/\d/);
    await expect(page.locator('[data-testid="hud-streak"]')).toContainText(/\d/);
    await expect(page.locator('[data-testid="hud-timer"]')).toContainText(/\d/);
    await expect(page.locator('[data-testid="hud-burst"]')).toBeVisible();

    const overflowY = await page.evaluate(() => window.getComputedStyle(document.body).overflowY);
    expect(overflowY).toBe('hidden');

    await page.evaluate(() => {
      localStorage.setItem('rubble:diag', 'true');
      location.reload();
    });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(
      () => document.querySelector('.rbl-diag')?.classList.contains('rbl-diag--on') === true,
    );

    const diag = page.locator('.rbl-diag');
    await expect(diag).toBeVisible();
    const diagText = await diag.textContent();
    console.log('DIAG:', diagText);

    expect(diagText || '').toMatch(/DPR/i);
    expect(diagText || '').toMatch(/CSS/i);
  });
});
