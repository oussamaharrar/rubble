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
    await canvas.waitFor({ state: 'visible', timeout: 15000 });
    await expect(canvas).toBeVisible();

    const hud = page.locator('.app-hud');
    await hud.waitFor({ state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-hud');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      if (parseFloat(style.opacity || '1') < 0.05) {
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
    await expect(score).toBeVisible();
    const scoreText = (await score.textContent())?.trim() ?? '';
    expect(scoreText).toMatch(/^\d+$/);

    const combo = page.locator('[data-testid="hud-combo"]');
    await expect(combo).toBeVisible();
    const comboText = (await combo.textContent())?.trim() ?? '';
    expect(comboText.length).toBeGreaterThan(0);

    const streak = page.locator('[data-testid="hud-streak"]');
    await expect(streak).toBeVisible();
    const streakText = (await streak.textContent())?.trim() ?? '';
    expect(streakText).toMatch(/^\d+$/);

    const timer = page.locator('[data-testid="hud-timer"]');
    await expect(timer).toBeVisible();
    const timerText = (await timer.textContent())?.trim() ?? '';
    expect(timerText).toMatch(/^\d{2}\.\d$/);

    const burst = page.locator('[data-testid="hud-burst"]');
    await expect(burst).toBeVisible();
    const burstText = (await burst.textContent())?.trim() ?? '';
    expect(/Ready|s$/i.test(burstText)).toBeTruthy();

    console.log(`HUD: score=${scoreText} combo=${comboText} streak=${streakText} time=${timerText} burst=${burstText}`);

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
