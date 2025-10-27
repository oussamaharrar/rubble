import { test, expect } from '@playwright/test';

test.describe('Rubble gameplay visibility', () => {
  test('canvas visible, sized, and HUD layered', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';
    await page.addInitScript(() => {
      window.localStorage.setItem('rubble:autoplay', 'true');
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const inner = page.locator('.app-frame__inner');
    await expect(inner).toBeVisible();

    const box = await inner.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(100);
    expect(box?.height || 0).toBeGreaterThan(100);

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
      return rect.width > 0;
    });
    const hudZ = await hud.evaluate((el) => getComputedStyle(el).zIndex);
    const canvasZ = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(parseInt(hudZ || '0')).toBeGreaterThan(parseInt(canvasZ || '0'));

    await page.waitForFunction(() => document.getElementById('rubble-root')?.getAttribute('data-playing') === '1');

    const score = page.locator('[data-testid="hud-score"]');
    const combo = page.locator('[data-testid="hud-combo"]');
    const streak = page.locator('[data-testid="hud-streak"]');
    const timer = page.locator('[data-testid="hud-timer"]');
    const burst = page.locator('[data-testid="hud-burst"]');

    await expect(score).toBeVisible();
    await expect(score).toHaveText(/^[0-9]+$/);
    await expect(combo).toBeVisible();
    await expect(combo).toHaveText(/^×?\d+$/);
    await expect(streak).toBeVisible();
    await expect(streak).toHaveText(/^[0-9]+$/);
    await expect(timer).toBeVisible();
    await expect(timer).toHaveText(/^\d{2}\.\d$/);
    await expect(burst).toBeVisible();
    const burstText = (await burst.textContent())?.trim() ?? '';
    expect(/Ready|s$/.test(burstText)).toBeTruthy();

    const hudSnapshot = {
      score: (await score.textContent())?.trim() ?? '',
      combo: (await combo.textContent())?.trim() ?? '',
      streak: (await streak.textContent())?.trim() ?? '',
      timer: (await timer.textContent())?.trim() ?? '',
      burst: burstText,
    };
    console.log('HUD:', hudSnapshot);

    const overflowY = await page.evaluate(() => window.getComputedStyle(document.body).overflowY);
    expect(overflowY).toBe('hidden');

    await page.evaluate(() => {
      localStorage.setItem('rubble:diag', 'true');
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
